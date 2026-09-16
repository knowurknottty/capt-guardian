import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GuardianService } from '../src/guardian/service.mjs';
import { createGuardianHttpServer } from '../src/http.mjs';

async function startFixture() {
  const root = mkdtempSync(join(tmpdir(), 'capt-guardian-http-'));
  const service = new GuardianService(join(root, 'state.json'), join(root, 'executions.jsonl'));
  const app = createGuardianHttpServer({ service, onerror: () => {} });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  return { app, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function decodeMcp(response) {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) return response.json();
  const body = await response.text();
  return body.split('\n').filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim())).at(-1);
}

test('real HTTP endpoint serves health and MCP 2025-11-25', async () => {
  const { app, baseUrl } = await startFixture();
  try {
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'http-test', version: '1' } },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal((await decodeMcp(response)).result.protocolVersion, '2025-11-25');
  } finally {
    await app.close();
  }
});

test('HTTP boundary rejects unapproved browser origin', async () => {
  const { app, baseUrl } = await startFixture();
  try {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json', accept: 'application/json, text/event-stream',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'origin-test', version: '1' } },
      }),
    });
    assert.equal(response.status, 403);
  } finally {
    await app.close();
  }
});
