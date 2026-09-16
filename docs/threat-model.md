# Threat Model

## Security objective

CAPT Guardian must fail closed: no model, Alexa component, MCP client, downstream adapter, or stale approval may acquire authority that was not explicitly granted for the exact action bytes being executed.

## Trust boundaries

1. Alexa+ / remote MCP client: authenticated request origin, never execution authority by itself.
2. Guardian MCP edge: schema validation and workflow ingress/egress only.
3. Guardian authority kernel: canonical action binding, approval state, policy evaluation.
4. Evidence plane: sourced observations and model-derived inference remain distinguishable.
5. Executor adapters: side-effect boundary; receive only already-authorized actions.
6. Receipt store: append-only execution/provenance evidence for replay and audit.

## Priority threats

| Threat | Required defense |
| --- | --- |
| Prompt/model tries to self-authorize | MCP has no approval mutation tool; the human decision API uses a separate credential and server-bound principal |
| Action changes after approval | Approval binds canonical SHA-256 action digest; execution recomputes before effect |
| Approval replay | Approval is single-use and records `consumedAt` |
| Explicit denial ignored | Latest denial blocks execution and remains in receipt |
| Inference presented as observation | Evidence kind is explicit and preserved into receipts/UI |
| Hidden fallback executor | Executor identity is recorded; no silent provider/tool substitution |
| Side effect occurs before receipt | Execution record captures exact action/authority/result; adapter response is bound into receipt |
| Alexa OAuth token mistaken for human consent | Account identity/authentication and per-action Guardian approval remain separate authority layers |
| Service token escalates into user actions | `mcp:service` permits initialization/discovery only; tool calls require user `mcp:tools` |
| Forged/wrong-audience JWT | Verify signature, issuer, audience, expiry and accepted algorithms against configured JWKS |
| Cross-household workflow access | Bind workflow to hashed OAuth principal and reject mismatched principals before read/mutation/execution |
| Human approval credential leaks | Header-only bearer credential, no query-string support, no-store responses, minimum secret length, rotate independently of Alexa OAuth |
| Stale Alexa registration | Tool/auth changes require redeploy and runtime revalidation |
| Repository leaks CAPT internals/secrets | Public allowlist; no mothership copy, credentials, private config, memory or research artifacts |
