import { randomUUID } from 'node:crypto';
import { actionBinding, findAction } from './action.mjs';
import { ApprovalDecision, assertEnum, digest, utcNow } from './model.mjs';

export function recordApproval(store, workflowId, actionId, principal, decision, rationale = '') {
  assertEnum(decision, ApprovalDecision, 'approval_decision');
  if (!principal?.trim()) throw new TypeError('principal_required');
  return store.update((state) => {
    const workflow = store.workflow(state, workflowId);
    const action = findAction(workflow, actionId);
    const currentDigest = digest(actionBinding(action));
    if (currentDigest !== action.actionDigest) throw new Error('action_digest_mismatch');
    const approval = {
      approvalId: `ap_${randomUUID()}`, workflowId, actionId,
      actionDigest: action.actionDigest, principal: principal.trim(), decision,
      rationale: rationale?.trim() || null, decidedAt: utcNow(), consumedAt: null,
    };
    approval.approvalDigest = digest({
      approvalId: approval.approvalId, workflowId, actionId,
      actionDigest: approval.actionDigest, principal: approval.principal,
      decision: approval.decision, decidedAt: approval.decidedAt,
    });
    workflow.approvals.push(approval);
    action.status = decision === ApprovalDecision.APPROVE ? 'APPROVED' : 'DENIED';
    return approval;
  });
}

export function latestApproval(workflow, actionId) {
  return workflow.approvals.filter((item) => item.actionId === actionId).at(-1) ?? null;
}
