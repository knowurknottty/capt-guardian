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

The public MCP server intentionally has no approval/authorization mutation tool. A future human channel must authenticate the principal independently of the agent, present the exact action/digest, and call the authority kernel out-of-band. The MCP client can then retry execution and receive either `blocked` or an execution receipt.

## Protocol serving

`@modelcontextprotocol/server` v2 serves the modern protocol and its built-in legacy stateless fallback serves 2025-era Streamable HTTP. Tests pin Alexa+ compatibility by negotiating `2025-11-25` explicitly.

The local Node boundary uses Host and Origin validation before the MCP handler. Public deployment must additionally add production OAuth/resource-server verification and remote latency evidence.
