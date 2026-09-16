import { randomUUID } from 'node:crypto';
import { assertEnum, AuthorityDenied, EvidenceKind, utcNow } from './model.mjs';

export function startWorkflow(store, intent, scenario = 'severe_weather', ownerPrincipal = null) {
  if (!intent?.trim()) throw new TypeError('intent_required');
  return store.update((state) => {
    const workflowId = `wf_${randomUUID()}`;
    const workflow = {
      workflowId, intent: intent.trim(), scenario, ownerPrincipal, state: 'OPEN', createdAt: utcNow(),
      evidence: [], actions: [], approvalRequests: [], approvals: [], executions: [],
    };
    state.workflows[workflowId] = workflow;
    return workflow;
  });
}

export function assertWorkflowPrincipal(workflow, principal = null) {
  if (workflow.ownerPrincipal && workflow.ownerPrincipal !== principal) {
    throw new AuthorityDenied('workflow_principal_mismatch');
  }
  return workflow;
}

export function inspectWorkflow(store, workflowId, principal = null) {
  const state = store.read();
  const workflow = store.workflow(state, workflowId);
  assertWorkflowPrincipal(workflow, principal);
  return structuredClone(workflow);
}

export function addEvidence(store, workflowId, kind, claim, sourceIdentity, provenance, confidence = null) {
  assertEnum(kind, EvidenceKind, 'evidence_kind');
  if (!claim?.trim() || !sourceIdentity?.trim()) throw new TypeError('evidence_claim_and_source_required');
  if (confidence !== null && (confidence < 0 || confidence > 1)) throw new RangeError('confidence_out_of_range');
  return store.update((state) => {
    const workflow = store.workflow(state, workflowId);
    const item = {
      evidenceId: `ev_${randomUUID()}`, kind, claim: claim.trim(), sourceIdentity: sourceIdentity.trim(),
      provenance: provenance ?? null, confidence, observedAt: utcNow(), recordedAt: utcNow(),
    };
    workflow.evidence.push(item);
    return item;
  });
}
