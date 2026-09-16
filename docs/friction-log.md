# Competition Friction Log

Entries are captured when encountered, not reconstructed at submission time.

## F-001 — Alexa+ MCP protocol-version documentation mismatch

- Date: 2026-09-16
- Task: Determine the protocol revision CAPT Guardian must implement for the Alexa+ track.
- Steps: Read current official hackathon rules, Alexa+ MCP QuickStart, and Alexa+ client lifecycle documentation.
- Expected: One consistent Alexa+ minimum/example protocol revision.
- Actual: Hackathon rules require MCP 2025-11-25 or later and Streamable HTTP; the current client lifecycle page still shows an `initialize` request example with `protocolVersion: 2025-03-26`.
- Severity: Important
- Workaround: Implement a modern MCP server that retains 2025-era Streamable HTTP compatibility; test actual Alexa+ negotiation rather than copying the lifecycle example literally.
- Actionable suggestion: Update lifecycle examples to the currently accepted Alexa+ revision or annotate legacy examples explicitly.
- Sources:
  - https://amazonappdev2026.devpost.com/rules
  - https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html

## F-002 — Alexa+ security/data policy still marked forthcoming

- Date: 2026-09-16
- Task: Freeze production data-handling assumptions for a household/caretaking MCP workflow.
- Expected: Complete current security/data policy requirements before architecture freeze.
- Actual: Alexa+ MCP QuickStart states that security and data policy details will be published in a future revision.
- Severity: Important
- Workaround: Minimize retained user data, keep evidence provenance explicit, and treat policy as a pre-submission recheck gate.
- Actionable suggestion: Publish the security/data policy before the submission deadline with a changelog and certification-impact notes.
- Source: https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html


## F-003 — Alexa account linking cannot be the per-action approval boundary

- Date: 2026-09-16
- Task: Bind Alexa customer identity while preserving explicit consent for consequential CAPT Guardian actions.
- Expected: Potentially reuse an OAuth step-up/consent flow for a high-consequence action.
- Actual: Current Alexa+ MCP documentation requires OAuth 2.1 authorization-code + PKCE S256 for account linking but lists step-up authorization as not supported yet.
- Severity: Architectural
- Workaround: Keep Alexa account linking as identity/authentication only. CAPT Guardian uses a separate human decision channel bound to the exact action digest.
- Actionable suggestion: Add a supported per-tool/per-action step-up or confirmation primitive that resource servers can request without conflating it with initial account linking.
- Sources:
  - https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html
  - https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html
