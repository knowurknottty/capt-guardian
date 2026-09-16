import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SignJWT, createLocalJWKSet, exportJWK, generateKeyPair,
} from 'jose';
import { GuardianService } from '../src/guardian/service.mjs';
import { createGuardianHttpServer } from '../src/http.mjs';
import {
  createJwtAccessTokenVerifier, createOAuthConfigFromEnv, createProtectedResourceMetadata,
} from '../src/auth.mjs';

const issuer = 'https://auth.guardian.example';
const resource = 'https://guardian.example/mcp';

async function cryptoFixture() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: 'test-key', alg: 'RS256', use: 'sig' });
  const keyResolver = createLocalJWKSet({ keys: [jwk] });
  const verifyAccessToken = createJwtAccessTokenVerifier({
    issuer, audience: resource, resource, keyResolver,
  });
  return { privateKey, verifyAccessToken };
}

async function token(privateKey, { scope, subject = 'user-1', clientId = 'alexa-client' }) {
  return new SignJWT({ scope, client_id: clientId })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(issuer).setAudience(resource).setSubject(subject)
    .setIssuedAt().setExpirationTime('5m').sign(privateKey);
}

test('PRM matches Alexa resource-server discovery contract', () => {
  const metadata = createProtectedResourceMetadata({
    resource, authorizationServer: issuer,
    scopes: ['mcp:service', 'mcp:tools', 'mcp:resources'],
  });
  assert.deepEqual(metadata, {
    resource,
    authorization_servers: [issuer],
    scopes_supported: ['mcp:service', 'mcp:tools', 'mcp:resources'],
  });
});

test('deployment OAuth config is fail-closed and emits Alexa PRM metadata', () => {
  assert.equal(createOAuthConfigFromEnv({}), null);
  assert.throws(
    () => createOAuthConfigFromEnv({ CAPT_GUARDIAN_OAUTH_ISSUER: issuer }),
    /oauth_configuration_incomplete/,
  );
  const oauth = createOAuthConfigFromEnv({
    CAPT_GUARDIAN_OAUTH_ISSUER: issuer,
    CAPT_GUARDIAN_OAUTH_RESOURCE: resource,
    CAPT_GUARDIAN_OAUTH_JWKS_URI: `${issuer}/.well-known/jwks.json`,
  });
  assert.equal(oauth.metadata.resource, resource);
  assert.deepEqual(oauth.metadata.authorization_servers, [issuer]);
  assert.deepEqual(oauth.metadata.scopes_supported, ['mcp:service', 'mcp:tools', 'mcp:resources']);
  assert.equal(typeof oauth.verifyAccessToken, 'function');
});

test('JWT verifier validates issuer, audience, scopes, and principal', async () => {
  const { privateKey, verifyAccessToken } = await cryptoFixture();
  const raw = await token(privateKey, { scope: 'mcp:tools mcp:resources', subject: 'household-42' });
  const info = await verifyAccessToken(raw);
  assert.equal(info.clientId, 'alexa-client');
  assert.deepEqual(info.scopes, ['mcp:tools', 'mcp:resources']);
  assert.equal(info.resource.href, resource);
  assert.equal(info.extra.subject, 'household-42');
  assert.match(info.extra.principal, /^oauth:/);
});

async function startHttpFixture() {
  const { privateKey, verifyAccessToken } = await cryptoFixture();
  const root = mkdtempSync(join(tmpdir(), 'capt-guardian-auth-'));
  const service = new GuardianService(join(root, 'state.json'), join(root, 'executions.jsonl'));
  const metadata = createProtectedResourceMetadata({
    resource, authorizationServer: issuer,
    scopes: ['mcp:service', 'mcp:tools', 'mcp:resources'],
  });
  const app = createGuardianHttpServer({ service, oauth: { metadata, verifyAccessToken }, onerror: () => {} });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  return { app, service, privateKey, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function decodeMcp(response) {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) return response.json();
  const body = await response.text();
  return body.split('\n').filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim())).at(-1);
}

async function postMcp(baseUrl, body, bearer) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  return fetch(`${baseUrl}/mcp`, { method: 'POST', headers, body: JSON.stringify(body) });
}

test('OAuth gate separates service discovery from user tool authority', async () => {
  const { app, privateKey, baseUrl } = await startHttpFixture();
  try {
    const prm = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    assert.equal(prm.status, 200);
    assert.equal((await prm.json()).resource, resource);

    const initialize = {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'auth-test', version: '1' } },
    };
    const missing = await postMcp(baseUrl, initialize);
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.has('www-authenticate'), false);

    const queryOnly = await fetch(`${baseUrl}/mcp?access_token=not-accepted`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(initialize),
    });
    assert.equal(queryOnly.status, 401);

    const serviceToken = await token(privateKey, { scope: 'mcp:service', subject: 'alexa-service' });
    const initialized = await postMcp(baseUrl, initialize, serviceToken);
    assert.equal(initialized.status, 200);
    assert.equal((await decodeMcp(initialized)).result.protocolVersion, '2025-11-25');

    const listed = await postMcp(baseUrl, {
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    }, serviceToken);
    assert.equal(listed.status, 200);
    assert.ok((await decodeMcp(listed)).result.tools.length >= 1);

    const deniedCall = await postMcp(baseUrl, {
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
        name: 'guardian_start_workflow', arguments: { intent: 'Prepare household' },
      },
    }, serviceToken);
    assert.equal(deniedCall.status, 403);

    const userToken = await token(privateKey, { scope: 'mcp:tools', subject: 'household-42' });
    const allowedCall = await postMcp(baseUrl, {
      jsonrpc: '2.0', id: 4, method: 'tools/call', params: {
        name: 'guardian_start_workflow', arguments: { intent: 'Prepare household' },
      },
    }, userToken);
    assert.equal(allowedCall.status, 200);
    const workflow = (await decodeMcp(allowedCall)).result.structuredContent;
    assert.equal(workflow.intent, 'Prepare household');
    assert.match(workflow.ownerPrincipal, /^oauth:/);
  } finally {
    await app.close();
  }
});
