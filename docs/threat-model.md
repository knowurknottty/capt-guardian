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
| Prompt/model tries to self-authorize | Model output is advisory evidence only; approval API requires explicit principal decision |
| Action changes after approval | Approval binds canonical SHA-256 action digest; execution recomputes before effect |
| Approval replay | Approval is single-use and records `consumedAt` |
| Explicit denial ignored | Latest denial blocks execution and remains in receipt |
| Inference presented as observation | Evidence kind is explicit and preserved into receipts/UI |
| Hidden fallback executor | Executor identity is recorded; no silent provider/tool substitution |
| Side effect occurs before receipt | Execution record captures exact action/authority/result; adapter response is bound into receipt |
| Stolen/broadened token | OAuth scopes and Guardian capability policy remain separate; least authority at both layers |
| Stale Alexa registration | Tool/auth changes require redeploy and runtime revalidation |
| Repository leaks CAPT internals/secrets | Public allowlist; no mothership copy, credentials, private config, memory or research artifacts |
