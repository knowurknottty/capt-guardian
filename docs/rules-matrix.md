# Competition Rules Matrix

Verified against official sources on 2026-09-16. Recheck immediately before submission.

| Area | Current requirement | CAPT Guardian gate |
| --- | --- | --- |
| Submission window | Ends 2026-10-23 12:00 PM PDT | Final compliance audit before deadline |
| Primary track | Alexa+ | Submit as Alexa+ primary |
| Runtime | Working Agent Skill or self-hosted MCP server | Use self-hosted MCP server |
| MCP revision | Minimum 2025-11-25, or later once confirmed | Server must negotiate Alexa+ supported 2025-era traffic |
| Transport | Streamable HTTP | `/mcp` remote endpoint |
| Runtime technology hook | Required tech must be imported/configured and actually called | Demo and tests must exercise real MCP runtime |
| Public repository | Public GitHub repository required | Publish clean derivative only |
| Open source | Repository requires visible open-source license | MIT license included before publication |
| Existing work | Pre-existing projects require significant in-window updates | Document competition-period derivative work |
| Demo | Public YouTube/Vimeo; less than 3 minutes | Runtime footage, not mock screenshots |
| Setup | Repository must include setup/run instructions | README reproduction gate |
| Alexa+ latency | MCP round-trip query response <500 ms | Automated latency gate |
| Remote reachability | MCP server accessible by remote URL | HTTPS deployment/tunnel gate |
| Authentication | OAuth 2.1/PKCE requirements apply when account linking is used | Consequential user actions must bind identity/authority |
| Open Source mini | New public project/contribution during hackathon window | Enter unless later rule change conflicts |
| AWS Builder mini | Kiro Crew alone currently qualifies as documented dev tooling | Preserve optional eligibility without runtime coupling |
| Friction log | Optional; up to 10% Stage 1 bonus | Maintain continuously |
| Prize stacking | At most one track prize plus one mini-challenge prize | Do not optimize around incompatible stacking assumptions |

## Official sources

- Hackathon rules: https://amazonappdev2026.devpost.com/rules
- Alexa+ MCP QuickStart: https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html
- Alexa+ MCP authentication: https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication.html
- Alexa+ MCP lifecycle: https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html
- MCP TypeScript server SDK: https://github.com/modelcontextprotocol/typescript-sdk/tree/main/packages/server

## Rule-drift hazards

- Alexa+ documentation currently shows examples from more than one MCP revision; treat the hackathon's explicit minimum and actual Alexa+ negotiation as authoritative.
- Amazon states security/data policy details may be revised; recheck before exposing real household/user data.
- Authentication attributes are cached by Alexa+ until add-on redeployment; auth changes require redeploy/retest.
- Never substitute the allowed simulated-Alexa path for this project's real-integration target unless an actual integration blocker makes that a deliberate fallback decision.
