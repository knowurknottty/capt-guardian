import { randomUUID } from 'node:crypto';
import { actionBinding, findAction } from './action.mjs';
import {
  findApprovalRequest, latestPendingApprovalRequest, ensureApprovalRequests,
} from './approval-request.mjs';
import {
  ApprovalDecision, AuthorityDenied, Consequence, assertEnum, digest, utcNow,
} from './model.mjs';

function currentActionDigest(action) {
  const current = digest(actionBinding(action));
  if (current !== action.actionDigest) throw new AuthorityDenied('action_digest_mismatch');
  return current;
}

function createApproval(workflow, action, request, principal, decision, rationale = '') {
  assertEnum(decision, ApprovalDecision, 'approval_decision');
  if (!principal?.trim()) throw new TypeError('principal_required');
  const approval = {
    approvalId: `ap_${randomUUID()}`, workflowId: workflow.workflowId, actionId: action.actionId,
    actionDigest: action.actionDigest, principal: principal.trim(), decision,
    rationale: rationale?.trim() || null, decidedAt: utcNow(), consumedAt: null,
    approvalRequestId: request?.approvalRequestId ?? null,
  };
  approval.approvalDigest = digest({
    approvalId: approval.approvalId, workflowId: approval.workflowId, actionId: approval.actionId,
    actionDigest: approval.actionDigest, principal: approval.principal,
    decision: approval.decision, decidedAt: approval.decidedAt,
    approvalRequestId: approval.approvalRequestId,
  });
  workflow.approvals.push(approval);
  action.status = decision === ApprovalDecision.APPROVE ? 'APPROVED' : 'DENIED';
  if (request) {
    request.status = decision === ApprovalDecision.APPROVE ? 'APPROVED' : 'DENIED';
    request.decision = decision;
    request.decidedAt = approval.decidedAt;
    request.principal = approval.principal;
    request.approvalId = approval.approvalId;
  }
  return approval;
}

export function recordApproval(store, workflowId, actionId, principal, decision, rationale = '') {
  return store.update((state) => {
    const workflow = store.workflow(state, workflowId);
    const action = findAction(workflow, actionId);
    currentActionDigest(action);
    const request = latestPendingApprovalRequest(workflow, actionId);
    if (action.consequence === Consequence.CONSEQUENTIAL && !request) {
      throw new AuthorityDenied('approval_request_required');
    }
    return createApproval(workflow, action, request, principal, decision, rationale);
  });
}

export function decideApprovalRequest(
  store, approvalRequestId, principal, decision, expectedActionDigest, rationale = '',
) {
  if (!expectedActionDigest) throw new TypeError('action_digest_required');
  return store.update((state) => {
    for (const workflow of Object.values(state.workflows)) {
      const request = ensureApprovalRequests(workflow)
        .find((item) => item.approvalRequestId === approvalRequestId);
      if (!request) continue;
      if (request.status !== 'PENDING') throw new AuthorityDenied('approval_request_not_pending');
      const action = findAction(workflow, request.actionId);
      currentActionDigest(action);
      if (request.actionDigest !== action.actionDigest || expectedActionDigest !== action.actionDigest) {
        throw new AuthorityDenied('approval_digest_mismatch');
      }
      return createApproval(workflow, action, request, principal, decision, rationale);
    }
    throw new RangeError(`approval_request_not_found:${approvalRequestId}`);
  });
}

export function listPendingApprovals(store) {
  const state = store.read();
  const results = [];
  for (const workflow of Object.values(state.workflows)) {
    for (const request of ensureApprovalRequests(workflow)) {
      if (request.status !== 'PENDING') continue;
      const action = findAction(workflow, request.actionId);
      results.push({
        ...structuredClone(request), intent: workflow.intent, scenario: workflow.scenario,
        capability: action.capability, summary: action.summary, consequence: action.consequence,
        payload: structuredClone(action.payload),
      });
    }
  }
  return results;
}

export function latestApproval(workflow, actionId) {
  return workflow.approvals.filter((item) => item.actionId === actionId).at(-1) ?? null;
}
