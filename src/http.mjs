import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer as createNodeServer } from 'node:http';
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { AuthorityDenied } from './guardian/service.mjs';
import { hasAnyScope, requiredScopesForMcpBody } from './auth.mjs';
import { createGuardianMcpHandler } from './mcp.mjs';

const DEFAULT_LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const MAX_HUMAN_BODY_BYTES = 16 * 1024;
const MAX_MCP_BODY_BYTES = 512 * 1024;

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function secureTokenEqual(expected, received) {
  const a = createHash('sha256').update(expected ?? '').digest();
  const b = createHash('sha256').update(received ?? '').digest();
  return timingSafeEqual(a, b);
}

function bearerToken(req) {
  const value = req.headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7);
}

async function readJsonBody(req, maxBytes = MAX_HUMAN_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const raw of req) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    size += chunk.length;
    if (size > maxBytes) throw new RangeError('request_body_too_large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text || '{}');
}

export function createGuardianHttpServer({
  service,
  allowedHostnames = DEFAULT_LOCAL_HOSTS,
  allowedOriginHostnames = DEFAULT_LOCAL_HOSTS,
  humanApprovalToken = null,
  humanPrincipal = 'human:local-operator',
  oauth = null,
  onerror = (error) => console.error('[capt-guardian]', error),
} = {}) {
  if (!service) throw new TypeError('service_required');
  if (humanApprovalToken && Buffer.byteLength(humanApprovalToken, 'utf8') < 32) {
    throw new RangeError('human_approval_token_too_short');
  }
  if (!humanPrincipal?.trim()) throw new TypeError('human_principal_required');

  const mcpHandler = createGuardianMcpHandler(service, { onerror });
  const nodeHandler = toNodeHandler(mcpHandler, { onerror });
  const validateHost = hostHeaderValidation(allowedHostnames);
  const validateOrigin = originValidation(allowedOriginHostnames);

  const server = createNodeServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname === '/healthz') {
      json(res, 200, { ok: true, service: 'capt-guardian' });
      return;
    }

    if (oauth && [
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/mcp',
    ].includes(url.pathname)) {
      if (!validateHost(req, res) || !validateOrigin(req, res)) return;
      json(res, 200, oauth.metadata);
      return;
    }

    if (url.pathname.startsWith('/human/')) {
      if (!humanApprovalToken) {
        json(res, 404, { error: 'not_found' });
        return;
      }
      if (!validateHost(req, res) || !validateOrigin(req, res)) return;
      if (!secureTokenEqual(humanApprovalToken, bearerToken(req))) {
        json(res, 401, { error: 'unauthorized' });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/human/approvals') {
        json(res, 200, service.listPendingApprovals());
        return;
      }

      const match = /^\/human\/approvals\/([^/]+)\/decision$/.exec(url.pathname);
      if (req.method === 'POST' && match) {
        try {
          const body = await readJsonBody(req);
          const approval = service.decideApprovalRequest(
            decodeURIComponent(match[1]), humanPrincipal, body.decision,
            body.actionDigest, body.rationale ?? '',
          );
          json(res, 200, approval);
        } catch (error) {
          if (error instanceof AuthorityDenied) {
            json(res, 409, { error: error.message });
          } else if (error instanceof RangeError && String(error.message).startsWith('approval_request_not_found:')) {
            json(res, 404, { error: 'approval_request_not_found' });
          } else if (error instanceof TypeError || error instanceof SyntaxError || error instanceof RangeError) {
            json(res, 400, { error: error.message });
          } else {
            onerror(error);
            json(res, 500, { error: 'internal_error' });
          }
        }
        return;
      }

      json(res, 404, { error: 'not_found' });
      return;
    }

    if (url.pathname !== '/mcp') {
      json(res, 404, { error: 'not_found' });
      return;
    }
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;

    let parsedBody;
    if (oauth) {
      const token = bearerToken(req);
      if (!token) {
        json(res, 401, { error: 'unauthorized' });
        return;
      }
      let authInfo;
      try {
        authInfo = await oauth.verifyAccessToken(token);
      } catch (error) {
        onerror(error);
        json(res, 401, { error: 'invalid_token' });
        return;
      }
      if (req.method === 'POST') {
        try {
          parsedBody = await readJsonBody(req, MAX_MCP_BODY_BYTES);
        } catch (error) {
          json(res, 400, { error: error.message });
          return;
        }
        const allowedScopes = requiredScopesForMcpBody(parsedBody);
        if (!hasAnyScope(authInfo, allowedScopes)) {
          json(res, 403, { error: 'insufficient_scope', required: allowedScopes });
          return;
        }
      }
      req.auth = authInfo;
    }

    try {
      await nodeHandler(req, res, parsedBody);
    } catch (error) {
      onerror(error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      if (!res.writableEnded) res.end(JSON.stringify({ error: 'internal_error' }));
    }
  });

  return {
    server,
    mcpHandler,
    async close() {
      await mcpHandler.close();
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

export { DEFAULT_LOCAL_HOSTS };
