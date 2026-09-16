# CAPT Guardian / CAPT Relay

A public Inversion Labs derivative of CAPT for the Amazon Build, Ship, Shape Alexa+ track.

**Alexa asks. Agents reason. CAPT governs. The human remains sovereign. The receipt proves it.**

CAPT Guardian is not a generic MCP wrapper. It inserts explicit authority, typed evidence, human approval, governed execution, and verifiable receipts between an Alexa+ intent and consequential side effects.

## Current proof

The repository currently proves a narrow but real authority path:

- MCP `2025-11-25` negotiation over Streamable HTTP;
- stateful Guardian workflows;
- explicit evidence typing;
- SHA-256 action binding;
- fail-closed consequential execution;
- single-use human approval;
- denial and tamper rejection;
- execution/provenance receipts;
- Host/Origin validation on the Node HTTP boundary.

The human approval decision is intentionally **not exposed as an MCP tool**. An agent may propose or attempt an action, but it cannot manufacture the human decision that unlocks it.

## Architecture

```text
Alexa+
  -> CAPT Guardian MCP edge
  -> workflow/evidence plane
  -> proposed action + action digest
  -> authority check
       -> no approval: BLOCK
       -> exact human approval: execute once
  -> execution adapter
  -> provenance/receipt
  -> Alexa+ response
```

The MCP surface currently exposes:

- `guardian_start_workflow`
- `guardian_inspect_workflow`
- `guardian_add_evidence`
- `guardian_propose_action`
- `guardian_execute_action`
- `guardian_get_receipt`

There is deliberately no `approve`, `authorize`, or `human_decision` MCP tool.

## Run locally

Requires Node.js 22+.

```bash
npm install
npm test
npm start
```

Default local endpoint:

```text
http://127.0.0.1:8788/mcp
```

Runtime state defaults to `.runtime/` and is intentionally ignored by Git.

Useful environment variables:

- `CAPT_GUARDIAN_HOST`
- `CAPT_GUARDIAN_PORT`
- `CAPT_GUARDIAN_STATE_DIR`
- `CAPT_GUARDIAN_ALLOWED_HOSTS`
- `CAPT_GUARDIAN_ALLOWED_ORIGINS`

Do not bind the development defaults publicly without configuring the production authentication and host/origin policy.

## Verification

`npm test` currently covers the authority kernel, MCP protocol surface, and real Node HTTP endpoint.

Local loopback latency evidence is written to `artifacts/perf/local-loopback.json` by:

```bash
node scripts/benchmark-mcp.mjs
```

The current benchmark is a local server baseline only. It does **not** prove Alexa-to-public-endpoint latency; remote deployment must be benchmarked separately.

## Competition engineering artifacts

- `docs/rules-matrix.md` — current official-rule requirements and gates
- `docs/threat-model.md` — authority and security boundaries
- `docs/friction-log.md` — integration/documentation friction captured as encountered
- `artifacts/perf/` — reproducible performance evidence

## Current limits

Not yet claimed complete: production OAuth/account linking, human approval UI/channel, external evidence adapters, specialist model cohorts, MCP App UI, remote Alexa+ invocation, or public-endpoint latency. These are explicit next gates rather than mocked features.

## License

MIT. This repository is the intentionally released public derivative; it is not the private CAPT mothership.
