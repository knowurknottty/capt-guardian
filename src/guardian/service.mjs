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

  startWorkflow(intent, scenario, ownerPrincipal = null) {
    return startWorkflow(this.store, intent, scenario, ownerPrincipal);
  }
  inspectWorkflow(workflowId, principal = null) { return inspectWorkflow(this.store, workflowId, principal); }
  assertWorkflowAccess(workflowId, principal = null) { return inspectWorkflow(this.store, workflowId, principal); }
  addEvidence(workflowId, kind, claim, sourceIdentity, provenance, confidence = null, principal = null) {
    this.assertWorkflowAccess(workflowId, principal);
    return addEvidence(this.store, workflowId, kind, claim, sourceIdentity, provenance, confidence);
  }
  proposeAction(workflowId, capability, summary, consequence, payload = {}, principal = null) {
    this.assertWorkflowAccess(workflowId, principal);
    return proposeAction(this.store, workflowId, capability, summary, consequence, payload);
  }
  recordApproval(workflowId, actionId, principal, decision, rationale = '') {
    return recordApproval(this.store, workflowId, actionId, principal, decision, rationale);
  }
  listPendingApprovals() { return listPendingApprovals(this.store); }
  decideApprovalRequest(approvalRequestId, principal, decision, actionDigest, rationale = '') {
    return decideApprovalRequest(this.store, approvalRequestId, principal, decision, actionDigest, rationale);
  }
  executeAction(workflowId, actionId, principal = null) {
    this.assertWorkflowAccess(workflowId, principal);
    return executeAction(this.store, workflowId, actionId, this.executor);
  }
  buildReceipt(workflowId, principal = null) {
    this.assertWorkflowAccess(workflowId, principal);
    return buildReceipt(this.store, workflowId);
  }
}

export { ApprovalDecision, AuthorityDenied, Consequence, EvidenceKind } from './model.mjs';
