import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { oauthPrincipal } from './auth.mjs';
import {
  ApprovalDecision, AuthorityDenied, Consequence, EvidenceKind, GuardianService,
} from '../src/guardian/service.mjs';

const textResult = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: value,
});

const evidenceKinds = [
  EvidenceKind.OBSERVATION,
  EvidenceKind.INFERENCE,
  EvidenceKind.UNCERTAINTY,
  EvidenceKind.COMPETING_EXPLANATION,
];

export function createGuardianMcpServer(service, ownerPrincipal = null) {
  const server = new McpServer({ name: 'capt-guardian', version: '0.1.0' });

  server.registerTool('guardian_start_workflow', {
    title: 'Start CAPT Guardian workflow',
    description: 'Open a governed stateful workflow. This grants no execution authority.',
    inputSchema: z.object({ intent: z.string().min(1), scenario: z.string().default('severe_weather') }),
  }, async ({ intent, scenario }) => textResult(service.startWorkflow(intent, scenario, ownerPrincipal)));

  server.registerTool('guardian_inspect_workflow', {
    title: 'Inspect CAPT Guardian workflow',
    description: 'Read current workflow, evidence, proposed actions, approvals, and executions.',
    inputSchema: z.object({ workflowId: z.string().min(1) }),
  }, async ({ workflowId }) => textResult(service.inspectWorkflow(workflowId, ownerPrincipal)));

  server.registerTool('guardian_add_evidence', {
    title: 'Add typed evidence',
    description: 'Record observation, inference, uncertainty, or competing explanation. FACT cannot be asserted directly by an agent.',
    inputSchema: z.object({
      workflowId: z.string().min(1),
      kind: z.enum(evidenceKinds),
      claim: z.string().min(1),
      sourceIdentity: z.string().min(1),
      provenance: z.unknown().optional(),
      confidence: z.number().min(0).max(1).nullable().optional(),
    }),
  }, async ({ workflowId, kind, claim, sourceIdentity, provenance, confidence }) => {
    const item = service.addEvidence(workflowId, kind, claim, sourceIdentity, provenance ?? null, confidence ?? null, ownerPrincipal);
    return textResult(item);
  });

  server.registerTool('guardian_propose_action', {
    title: 'Propose governed action',
    description: 'Create a digest-bound proposed action. Consequential proposals still require a separate human decision.',
    inputSchema: z.object({
      workflowId: z.string().min(1),
      capability: z.string().min(1),
      summary: z.string().min(1),
      consequence: z.enum(Object.values(Consequence)),
      payload: z.record(z.string(), z.unknown()).default({}),
    }),
  }, async ({ workflowId, capability, summary, consequence, payload }) =>
    textResult(service.proposeAction(workflowId, capability, summary, consequence, payload, ownerPrincipal)));

  server.registerTool('guardian_execute_action', {
    title: 'Execute authorized action',
    description: 'Attempt execution. Consequential actions fail closed until a separately authenticated human approval exists.',
    inputSchema: z.object({ workflowId: z.string().min(1), actionId: z.string().min(1) }),
  }, async ({ workflowId, actionId }) => {
    try {
      return textResult(service.executeAction(workflowId, actionId, ownerPrincipal));
    } catch (error) {
      if (!(error instanceof AuthorityDenied)) throw error;
      return textResult({ status: 'blocked', reason: error.message, workflowId, actionId });
    }
  });

  server.registerTool('guardian_get_receipt', {
    title: 'Get CAPT Guardian receipt',
    description: 'Return the provenance-bound workflow receipt, including unresolved and denied actions.',
    inputSchema: z.object({ workflowId: z.string().min(1) }),
  }, async ({ workflowId }) => textResult(service.buildReceipt(workflowId, ownerPrincipal)));

  return server;
}

export function createGuardianMcpHandler(service, options = {}) {
  return createMcpHandler(
    (ctx) => createGuardianMcpServer(service, ctx.authInfo ? oauthPrincipal(ctx.authInfo) : null),
    {
      legacy: 'stateless',
      onerror: options.onerror,
    },
  );
}

export function createGuardianService(statePath, executionLogPath) {
  return new GuardianService(statePath, executionLogPath);
}

export { ApprovalDecision, Consequence, EvidenceKind };
