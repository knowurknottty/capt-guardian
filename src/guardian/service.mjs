import { JsonStateStore } from './store.mjs';
import { startWorkflow, inspectWorkflow, addEvidence } from './workflow.mjs';
import { proposeAction } from './action.mjs';
import { recordApproval, decideApprovalRequest, listPendingApprovals } from './approval.mjs';
import { executeAction, JsonlActionExecutor } from './executor.mjs';
import { buildReceipt } from './receipt.mjs';

export class GuardianService {
  constructor(statePath, executionLogPath) {
    this.store = new JsonStateStore(statePath);
    this.executor = new JsonlActionExecutor(executionLogPath);
  }

  startWorkflow(intent, scenario) { return startWorkflow(this.store, intent, scenario); }
  inspectWorkflow(workflowId) { return inspectWorkflow(this.store, workflowId); }
  addEvidence(workflowId, kind, claim, sourceIdentity, provenance, confidence = null) {
    return addEvidence(this.store, workflowId, kind, claim, sourceIdentity, provenance, confidence);
  }
  proposeAction(workflowId, capability, summary, consequence, payload = {}) {
    return proposeAction(this.store, workflowId, capability, summary, consequence, payload);
  }
  recordApproval(workflowId, actionId, principal, decision, rationale = '') {
    return recordApproval(this.store, workflowId, actionId, principal, decision, rationale);
  }
  listPendingApprovals() { return listPendingApprovals(this.store); }
  decideApprovalRequest(approvalRequestId, principal, decision, actionDigest, rationale = '') {
    return decideApprovalRequest(this.store, approvalRequestId, principal, decision, actionDigest, rationale);
  }
  executeAction(workflowId, actionId) {
    return executeAction(this.store, workflowId, actionId, this.executor);
  }
  buildReceipt(workflowId) { return buildReceipt(this.store, workflowId); }
}

export { ApprovalDecision, AuthorityDenied, Consequence, EvidenceKind } from './model.mjs';
