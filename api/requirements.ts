// Vercel serverless endpoint: POST /api/requirements
// Thin HTTP wrapper around server/submitHandler.ts (the shared core).

import type { IncomingMessage, ServerResponse } from 'node:http';
import { waitUntil } from '@vercel/functions';
import { submitRequirement, deferDetached } from '../server/submitHandler.ts';

const MAX_BODY_BYTES = 262144;

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** Accept only plain non-array objects as a submission body. */
function asPlainObject(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

type BodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413; error: string };

async function readJsonBody(req: IncomingMessage): Promise<BodyResult> {
  // Vercel pre-parses application/json bodies into req.body. When present it
  // is authoritative: the stream is already consumed and must never fall
  // through to req.on('data') (that hangs forever).
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (preParsed !== undefined) {
    let value: unknown = preParsed;
    if (typeof preParsed === 'string') {
      try {
        value = JSON.parse(preParsed);
      } catch {
        return { ok: false, status: 400, error: 'malformed JSON body' };
      }
    }
    const obj = asPlainObject(value);
    if (!obj) return { ok: false, status: 400, error: 'malformed JSON body' };
    return { ok: true, value: obj };
  }

  // Raw stream (no pre-parsed body): read with a hard byte cap — the stored
  // full_payload makes unbounded bodies an amplification risk.
  let raw: string;
  try {
    raw = await new Promise<string>((resolve, reject) => {
      let data = '';
      let size = 0;
      const onData = (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          req.removeListener('data', onData);
          req.resume(); // discard the remainder
          reject(Object.assign(new Error('payload too large'), { code: 'PAYLOAD_TOO_LARGE' }));
          return;
        }
        data += c;
      };
      req.on('data', onData);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'PAYLOAD_TOO_LARGE') {
      return { ok: false, status: 413, error: 'payload too large' };
    }
    return { ok: false, status: 400, error: 'malformed JSON body' };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: 'malformed JSON body' };
  }
  const obj = asPlainObject(value);
  if (!obj) return { ok: false, status: 400, error: 'malformed JSON body' };
  return { ok: true, value: obj };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method not allowed' });
    return;
  }

  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    send(res, parsed.status, { error: parsed.error });
    return;
  }

  try {
    const result = await submitRequirement(parsed.value, {
      // Vercel: keep the mail task alive after the response is flushed.
      deferWork: (fn) => {
        let started = false;
        const start = () => {
          if (started) return undefined;
          started = true;
          return fn();
        };
        try {
          waitUntil(
            Promise.resolve()
              .then(start)
              .catch((err) => {
                console.error('[notify] deferred work failed (ignored):', err);
              }),
          );
        } catch (err) {
          // Outside a Vercel request context waitUntil can throw; fall back
          // to the detached defer so a committed success is never turned
          // into a 500 (and the notify thunk still runs exactly once).
          console.error('[notify] waitUntil unavailable, deferring detached (ignored):', err);
          deferDetached(start);
        }
      },
    });
    if (result.ok) {
      send(res, 201, { id: result.id, created_at: result.created_at });
    } else {
      send(res, result.status, { error: result.error, invalid: result.invalid });
    }
  } catch (err) {
    console.error('submit error:', err);
    send(res, 500, { error: 'internal error' });
  }
}
