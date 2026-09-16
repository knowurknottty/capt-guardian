import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { GuardianService } from './guardian/service.mjs';
import { createGuardianHttpServer } from './http.mjs';
import { createOAuthConfigFromEnv } from './auth.mjs';

const host = process.env.CAPT_GUARDIAN_HOST ?? '127.0.0.1';
const port = Number(process.env.CAPT_GUARDIAN_PORT ?? '8788');
const stateDir = resolve(process.env.CAPT_GUARDIAN_STATE_DIR ?? '.runtime');
mkdirSync(stateDir, { recursive: true });

const service = new GuardianService(
  join(stateDir, 'guardian-state.json'),
  join(stateDir, 'executions.jsonl'),
);

const allowedHostnames = (process.env.CAPT_GUARDIAN_ALLOWED_HOSTS ?? 'localhost,127.0.0.1,[::1]')
  .split(',').map((value) => value.trim()).filter(Boolean);
const allowedOriginHostnames = (process.env.CAPT_GUARDIAN_ALLOWED_ORIGINS ?? 'localhost,127.0.0.1,[::1]')
  .split(',').map((value) => value.trim()).filter(Boolean);

const humanApprovalToken = process.env.CAPT_GUARDIAN_HUMAN_APPROVAL_TOKEN ?? null;
const humanPrincipal = process.env.CAPT_GUARDIAN_HUMAN_PRINCIPAL ?? 'human:local-operator';
const oauth = createOAuthConfigFromEnv(process.env);

const app = createGuardianHttpServer({
  service, allowedHostnames, allowedOriginHostnames, humanApprovalToken, humanPrincipal, oauth,
});
app.server.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'capt_guardian_listening', host, port, mcpPath: '/mcp' }));
});

async function shutdown(signal) {
  console.log(JSON.stringify({ event: 'capt_guardian_shutdown', signal }));
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
