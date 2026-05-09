import fs from 'node:fs';
import path from 'node:path';

const scriptName = 'loom-video-admin';
const repoRoot = path.resolve(import.meta.dirname, '..');
const workerPath = path.join(import.meta.dirname, 'worker.js');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const streamToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || apiToken;
const deletePasscode = process.env.DELETE_PASSCODE;
const allowedOrigins = process.env.ALLOWED_ORIGINS ||
  'https://raulg0mez.github.io,http://127.0.0.1:4173,http://127.0.0.1:4321,http://localhost:4173,http://localhost:4321';

if (!accountId || !apiToken || !streamToken || !deletePasscode) {
  console.error('Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, DELETE_PASSCODE.');
  console.error('Optional: CLOUDFLARE_STREAM_API_TOKEN, ALLOWED_ORIGINS.');
  process.exit(1);
}

async function cloudflare(route, options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${route}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok || payload.success === false) {
    const error = payload.errors?.map((item) => item.message).join('; ') || text;
    throw new Error(`${options.method || 'GET'} ${route} failed: ${response.status} ${error}`);
  }

  return payload;
}

const metadata = {
  main_module: 'worker.js',
  compatibility_date: '2026-05-01',
  bindings: [
    { type: 'plain_text', name: 'CLOUDFLARE_ACCOUNT_ID', text: accountId },
    { type: 'plain_text', name: 'ALLOWED_ORIGINS', text: allowedOrigins }
  ]
};

const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
form.append('worker.js', new Blob([fs.readFileSync(workerPath, 'utf8')], { type: 'application/javascript+module' }), 'worker.js');

await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}`, { method: 'PUT', body: form });
await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/secrets`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'CLOUDFLARE_STREAM_API_TOKEN', text: streamToken, type: 'secret_text' })
});
await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/secrets`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'DELETE_PASSCODE', text: deletePasscode, type: 'secret_text' })
});
await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: true })
});

const subdomain = await cloudflare(`/accounts/${accountId}/workers/subdomain`);
console.log(`https://${scriptName}.${subdomain.result.subdomain}.workers.dev`);
