// Standalone Node HTTP server exposing POST /api/requirements.
// Thin wrapper around server/submitHandler.ts (the shared core).
//
// Run locally against the real DB:
//   node server/standalone.mjs
// Used for local E2E and as the possible self-host route (49.200.186.6).

import http from 'node:http';
import { submitRequirement, deferDetached } from './submitHandler.ts';

const port = Number(process.env.PORT || 8787);

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
      req.on('data', (c) => {
        data += c;
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  } catch {
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
  if (body === null || typeof body !== 'object') {
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
      send(res, result.status, { error: result.error });
    }
  } catch (err) {
    console.error('[req] submit error:', err);
    send(res, 500, { error: 'internal error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`standalone server listening on http://127.0.0.1:${port}`);
});
