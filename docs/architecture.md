# Architecture

## Invariant

No downstream model, MCP client, Alexa component, or executor receives authority that CAPT Guardian did not explicitly grant for the exact action being executed.

## Planes

1. **MCP edge** — validates Alexa+/MCP inputs and exposes bounded workflow tools.
2. **Workflow plane** — holds intent, scenario, evidence, proposed actions, approvals, and executions.
3. **Evidence plane** — preserves epistemic type and provenance; model inference is never silently promoted to observation/fact.
4. **Authority plane** — canonicalizes the proposed action and binds approval to its SHA-256 digest.
5. **Execution plane** — receives an already-authorized action and records executor identity/result.
6. **Receipt plane** — returns the complete causal chain and unresolved/denied state.

## Authority transition

```text
PROPOSED
  -> execute consequential action without approval = BLOCKED
  -> human decision DENY = DENIED
  -> human decision APPROVE = APPROVED
  -> exact digest matches + approval unused = EXECUTED
  -> mutated digest / stale or consumed approval = BLOCKED
```

## Evidence contract

Current evidence records carry:

- `evidenceId`
- `kind`
- `claim`
- `sourceIdentity`
- `provenance`
- `confidence`
- `observedAt`
- `recordedAt`

MCP callers may record `OBSERVATION`, `INFERENCE`, `UNCERTAINTY`, or `COMPETING_EXPLANATION`. They cannot assert `FACT` directly through the public MCP surface; a later verification primitive will own fact promotion.

## Human sovereignty boundary

The public MCP server intentionally has no approval/authorization mutation tool. The human channel is a separate HTTP surface protected by an independent bearer credential. It lists pending approval requests, shows the exact action digest, derives the principal server-side, and requires that digest to be echoed with APPROVE/DENY. A mismatch is rejected without changing authority. The MCP client can only retry execution and receive either `blocked` or an execution receipt.

Alexa account linking and Guardian approval are intentionally separate. Alexa OAuth establishes who the linked customer is and whether a request is authenticated; it does not constitute per-action human consent. Amazon currently does not support step-up authorization for MCP add-ons, so Guardian must preserve its own explicit action-consent boundary.

## Protocol serving

`@modelcontextprotocol/server` v2 serves the modern protocol and its built-in legacy stateless fallback serves 2025-era Streamable HTTP. Tests pin Alexa+ compatibility by negotiating `2025-11-25` explicitly.

The local Node boundary uses Host and Origin validation before the MCP handler. Public deployment must additionally add production OAuth/resource-server verification and remote latency evidence.
