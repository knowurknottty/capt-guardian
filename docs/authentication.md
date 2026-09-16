# Authentication and Authority Separation

CAPT Guardian treats identity, MCP scope, and consequential-action approval as different control planes.

## 1. Alexa / MCP identity

When OAuth is enabled, Guardian operates as an OAuth resource server. It verifies JWT access tokens using a configured authorization-server issuer, expected audience/resource, accepted signing algorithms, and JWKS key set.

Required deployment variables:

- `CAPT_GUARDIAN_OAUTH_ISSUER`
- `CAPT_GUARDIAN_OAUTH_RESOURCE`
- `CAPT_GUARDIAN_OAUTH_JWKS_URI`

Optional variables:

- `CAPT_GUARDIAN_OAUTH_AUDIENCE`
- `CAPT_GUARDIAN_OAUTH_SCOPES`
- `CAPT_GUARDIAN_OAUTH_ALGORITHMS`

If none of the required variables are set, OAuth is disabled for local development. If only some are set, Guardian refuses to construct the deployment configuration.

## 2. Scope separation

Guardian currently recognizes the Alexa-facing scope split:

- `mcp:service` — initialization and discovery only;
- `mcp:tools` — user-level tool calls;
- `mcp:resources` — resource operations.

A service credential cannot invoke a Guardian tool. A user credential cannot become execution authority merely because it carries `mcp:tools`.

## 3. Tenant isolation

Each OAuth-created workflow stores a stable principal derived from the signed token subject and issuer. The stored value is hashed rather than copying the raw subject identifier into workflow state.

Reads, evidence mutation, action proposal, execution attempts, and receipt access all require the same OAuth principal when a workflow has an owner. A different linked identity fails with `workflow_principal_mismatch`.

## 4. Human approval

Consequential action approval is deliberately outside MCP OAuth. The MCP server exposes no approve/authorize tool. The human decision channel has a separate bearer credential and server-bound human principal.

The decision must echo the exact SHA-256 action digest presented for review. Digest mismatch, denial, consumed approval, or post-approval action mutation all fail closed.

This separation is intentional:

```text
OAuth identity + MCP scope
        !=
CAPT authority for a consequential side effect
```

## 5. Protected Resource Metadata

When OAuth is configured, Guardian serves RFC 9728-style metadata at:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/mcp`

Guardian does not implement an authorization server. Deployment must supply a compatible external OAuth authorization server and Alexa+ account-linking configuration.
