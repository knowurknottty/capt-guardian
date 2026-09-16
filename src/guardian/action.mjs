import { randomUUID } from 'node:crypto';
import { assertEnum, Consequence, digest, utcNow } from './model.mjs';
import { createApprovalRequestForAction } from './approval-request.mjs';

export function actionBinding(action) {
  return {
    workflowId: action.workflowId,
    actionId: action.actionId,
    capability: action.capability,
    summary: action.summary,
    consequence: action.consequence,
    payload: action.payload,
  };
}

export function proposeAction(store, workflowId, capability, summary, consequence, payload = {}) {
  assertEnum(consequence, Consequence, 'consequence');
  if (!capability?.trim() || !summary?.trim()) throw new TypeError('capability_and_summary_required');
  return store.update((state) => {
    const workflow = store.workflow(state, workflowId);
    const action = {
      actionId: `act_${randomUUID()}`, workflowId,
      capability: capability.trim(), summary: summary.trim(), consequence,
      payload: structuredClone(payload), status: 'PROPOSED', createdAt: utcNow(),
    };
    action.actionDigest = digest(actionBinding(action));
    workflow.actions.push(action);
    if (consequence === Consequence.CONSEQUENTIAL) {
      const request = createApprovalRequestForAction(workflow, action);
      action.approvalRequestId = request.approvalRequestId;
    }
    return action;
  });
}

export function findAction(workflow, actionId) {
  const action = workflow.actions.find((candidate) => candidate.actionId === actionId);
  if (!action) throw new RangeError(`action_not_found:${actionId}`);
  return action;
}
