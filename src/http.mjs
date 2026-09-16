import { createServer as createNodeServer } from 'node:http';
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createGuardianMcpHandler } from './mcp.mjs';

const DEFAULT_LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function createGuardianHttpServer({
  service,
  allowedHostnames = DEFAULT_LOCAL_HOSTS,
  allowedOriginHostnames = DEFAULT_LOCAL_HOSTS,
  onerror = (error) => console.error('[capt-guardian]', error),
} = {}) {
  if (!service) throw new TypeError('service_required');
  const mcpHandler = createGuardianMcpHandler(service, { onerror });
  const nodeHandler = toNodeHandler(mcpHandler, { onerror });
  const validateHost = hostHeaderValidation(allowedHostnames);
  const validateOrigin = originValidation(allowedOriginHostnames);

  const server = createNodeServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'capt-guardian' }));
      return;
    }
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    try {
      await nodeHandler(req, res);
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
