// Standalone Node HTTP server exposing POST /api/requirements.
// Thin wrapper around server/submitHandler.ts (the shared core).
//
// Run locally against the real DB:
//   node server/standalone.mjs
// Used for local E2E and as the possible self-host route (49.200.186.6).

import http from 'node:http';
import { submitRequirement, deferDetached } from './submitHandler.ts';

const port = Number(process.env.PORT || 8787);

// Hard body cap: the stored full_payload makes unbounded bodies an
// amplification risk.
const MAX_BODY_BYTES = 262144;

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname !== '/api/requirements') {
    send(res, 404, { error: 'not found' });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'method not allowed' });
    return;
  }

  let raw = '';
  try {
    raw = await new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      const onData = (c) => {
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
    if (err && err.code === 'PAYLOAD_TOO_LARGE') {
      send(res, 413, { error: 'payload too large' });
      return;
    }
    send(res, 400, { error: 'malformed JSON body' });
    return;
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    send(res, 400, { error: 'malformed JSON body' });
    return;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    send(res, 400, { error: 'malformed JSON body' });
    return;
  }

  try {
    // Detached-promise defer: plain Node keeps the process alive until the
    // (best-effort) mail task settles, without delaying the 201.
    const result = await submitRequirement(body, { deferWork: deferDetached });
    if (result.ok) {
      console.log(`[req] 201 ${result.id}`);
      send(res, 201, { id: result.id, created_at: result.created_at });
    } else {
      console.log(`[req] ${result.status} ${result.error}`);
      send(res, result.status, { error: result.error, invalid: result.invalid });
    }
  } catch (err) {
    console.error('[req] submit error:', err);
    send(res, 500, { error: 'internal error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`standalone server listening on http://127.0.0.1:${port}`);
});
