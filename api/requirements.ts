// Vercel serverless endpoint: POST /api/requirements
// Thin HTTP wrapper around server/submitHandler.ts (the shared core).

import type { IncomingMessage, ServerResponse } from 'node:http';
import { submitRequirement } from '../server/submitHandler.ts';

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<{ ok: boolean; value: unknown }> {
  // Vercel pre-parses application/json bodies; standalone use passes raw.
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  let raw = typeof preParsed === 'string' ? preParsed : '';
  if (preParsed !== null && typeof preParsed === 'object') return { ok: true, value: preParsed };
  if (!raw) {
    raw = await new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', (c: Buffer) => {
        data += c;
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, value: undefined };
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method not allowed' });
    return;
  }

  const parsed = await readJsonBody(req);
  if (!parsed.ok || parsed.value === null || typeof parsed.value !== 'object') {
    send(res, 400, { error: 'malformed JSON body' });
    return;
  }

  try {
    const result = await submitRequirement(parsed.value as Record<string, unknown>);
    if (result.ok) {
      send(res, 201, { id: result.id, created_at: result.created_at });
    } else {
      send(res, result.status, { error: result.error });
    }
  } catch (err) {
    console.error('submit error:', err);
    send(res, 500, { error: 'internal error' });
  }
}
