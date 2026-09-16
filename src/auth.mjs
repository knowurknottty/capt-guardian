import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

function normalizeScopes(payload) {
  if (Array.isArray(payload.scp)) return payload.scp.filter((item) => typeof item === 'string');
  if (typeof payload.scope === 'string') return payload.scope.split(/\s+/).filter(Boolean);
  return [];
}

function principalFor(issuer, subject) {
  const hash = createHash('sha256').update(`${issuer}\0${subject}`).digest('hex');
  return `oauth:${hash}`;
}

export function createProtectedResourceMetadata({ resource, authorizationServer, scopes }) {
  if (!resource || !authorizationServer) throw new TypeError('resource_and_authorization_server_required');
  return {
    resource,
    authorization_servers: [authorizationServer],
    scopes_supported: [...scopes],
  };
}

export function createJwtAccessTokenVerifier({
  issuer, audience, resource = audience, jwksUri = null, keyResolver = null,
  algorithms = ['RS256'],
}) {
  if (!issuer || !audience || !resource) throw new TypeError('issuer_audience_resource_required');
  const resolver = keyResolver ?? (jwksUri ? createRemoteJWKSet(new URL(jwksUri)) : null);
  if (!resolver) throw new TypeError('jwks_uri_or_key_resolver_required');
  return async function verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, resolver, { issuer, audience, algorithms });
    if (!payload.sub) throw new Error('token_subject_required');
    const scopes = normalizeScopes(payload);
    const clientId = payload.client_id ?? payload.azp;
    if (typeof clientId !== 'string' || !clientId) throw new Error('token_client_id_required');
    const principal = principalFor(issuer, payload.sub);
    return {
      token,
      clientId,
      scopes,
      expiresAt: payload.exp,
      resource: new URL(resource),
      extra: { subject: payload.sub, principal, issuer },
    };
  };
}

export function requiredScopesForMcpBody(body) {
  const messages = Array.isArray(body) ? body : [body];
  const methods = messages.map((item) => item?.method).filter(Boolean);
  if (methods.some((method) => method === 'tools/call')) return ['mcp:tools'];
  if (methods.some((method) => method?.startsWith('resources/'))) return ['mcp:resources'];
  if (methods.every((method) => ['initialize', 'notifications/initialized', 'tools/list', 'ping'].includes(method))) {
    return ['mcp:service', 'mcp:tools', 'mcp:resources'];
  }
  return ['mcp:tools'];
}

export function hasAnyScope(authInfo, allowedScopes) {
  return allowedScopes.some((scope) => authInfo.scopes.includes(scope));
}

export function oauthPrincipal(authInfo) {
  const principal = authInfo?.extra?.principal;
  if (typeof principal !== 'string' || !principal.startsWith('oauth:')) {
    throw new Error('oauth_principal_required');
  }
  return principal;
}

export function createOAuthConfigFromEnv(env = process.env) {
  const issuer = env.CAPT_GUARDIAN_OAUTH_ISSUER ?? null;
  const resource = env.CAPT_GUARDIAN_OAUTH_RESOURCE ?? null;
  const jwksUri = env.CAPT_GUARDIAN_OAUTH_JWKS_URI ?? null;
  const audience = env.CAPT_GUARDIAN_OAUTH_AUDIENCE ?? resource;
  const configured = [issuer, resource, jwksUri].some(Boolean);
  if (!configured) return null;
  if (!issuer || !resource || !jwksUri) throw new TypeError('oauth_configuration_incomplete');
  const scopes = (env.CAPT_GUARDIAN_OAUTH_SCOPES ?? 'mcp:service,mcp:tools,mcp:resources')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (!scopes.length) throw new TypeError('oauth_scopes_required');
  const algorithms = (env.CAPT_GUARDIAN_OAUTH_ALGORITHMS ?? 'RS256')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const metadata = createProtectedResourceMetadata({
    resource, authorizationServer: issuer, scopes,
  });
  const verifyAccessToken = createJwtAccessTokenVerifier({
    issuer, audience, resource, jwksUri, algorithms,
  });
  return { metadata, verifyAccessToken };
}
