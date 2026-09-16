import { randomUUID } from 'node:crypto';
import { utcNow } from './model.mjs';

export function ensureApprovalRequests(workflow) {
  workflow.approvalRequests ??= [];
  return workflow.approvalRequests;
}

export function createApprovalRequestForAction(workflow, action) {
  const request = {
    approvalRequestId: `apr_${randomUUID()}`,
    workflowId: workflow.workflowId,
    actionId: action.actionId,
    actionDigest: action.actionDigest,
    status: 'PENDING',
    requestedAt: utcNow(),
    decidedAt: null,
    decision: null,
    principal: null,
    approvalId: null,
  };
  ensureApprovalRequests(workflow).push(request);
  return request;
}

export function latestPendingApprovalRequest(workflow, actionId) {
  return ensureApprovalRequests(workflow)
    .filter((item) => item.actionId === actionId && item.status === 'PENDING')
    .at(-1) ?? null;
}

export function findApprovalRequest(workflow, approvalRequestId) {
  const request = ensureApprovalRequests(workflow)
    .find((item) => item.approvalRequestId === approvalRequestId);
  if (!request) throw new RangeError(`approval_request_not_found:${approvalRequestId}`);
  return request;
}
