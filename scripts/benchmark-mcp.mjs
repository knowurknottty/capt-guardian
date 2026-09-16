import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { GuardianService } from '../src/guardian/service.mjs';
import { createGuardianHttpServer } from '../src/http.mjs';

const samples = Number(process.env.CAPT_GUARDIAN_BENCH_SAMPLES ?? '100');
const warmup = Number(process.env.CAPT_GUARDIAN_BENCH_WARMUP ?? '10');
const output = resolve(process.env.CAPT_GUARDIAN_BENCH_OUT ?? 'artifacts/perf/local-loopback.json');
const root = mkdtempSync(join(tmpdir(), 'capt-guardian-bench-'));
const service = new GuardianService(join(root, 'state.json'), join(root, 'execution.jsonl'));
const app = createGuardianHttpServer({ service, onerror: () => {} });
await new Promise((resolveListen) => app.server.listen(0, '127.0.0.1', resolveListen));
const address = app.server.address();
const url = `http://127.0.0.1:${address.port}/mcp`;

function body(id) {
  return JSON.stringify({
    jsonrpc: '2.0', id, method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'bench', version: '1' } },
  });
}

async function one(id) {
  const started = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: body(id),
  });
  await response.text();
  if (response.status !== 200) throw new Error(`unexpected_status:${response.status}`);
  return performance.now() - started;
}

for (let i = 0; i < warmup; i += 1) await one(`warmup-${i}`);
const timings = [];
for (let i = 0; i < samples; i += 1) timings.push(await one(i));
timings.sort((a, b) => a - b);
const q = (fraction) => timings[Math.min(timings.length - 1, Math.floor((timings.length - 1) * fraction))];
const report = {
  benchmark: 'capt-guardian-local-loopback-initialize', protocolVersion: '2025-11-25',
  samples, warmup, p50Ms: q(0.50), p95Ms: q(0.95), p99Ms: q(0.99), maxMs: timings.at(-1),
  meanMs: timings.reduce((sum, value) => sum + value, 0) / timings.length,
  thresholdMs: 500, passesLocalThreshold: q(0.95) < 500,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
await app.close();
if (!report.passesLocalThreshold) process.exitCode = 1;
