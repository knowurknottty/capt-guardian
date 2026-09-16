import { randomUUID } from 'node:crypto';
import { assertEnum, EvidenceKind, utcNow } from './model.mjs';

export function startWorkflow(store, intent, scenario = 'severe_weather') {
  if (!intent?.trim()) throw new TypeError('intent_required');
  return store.update((state) => {
    const workflowId = `wf_${randomUUID()}`;
    const workflow = {
      workflowId, intent: intent.trim(), scenario, state: 'OPEN', createdAt: utcNow(),
      evidence: [], actions: [], approvals: [], executions: [],
    };
    state.workflows[workflowId] = workflow;
    return workflow;
  });
}

export function inspectWorkflow(store, workflowId) {
  const state = store.read();
  return structuredClone(store.workflow(state, workflowId));
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
