import { digest, utcNow } from './model.mjs';
import { inspectWorkflow } from './workflow.mjs';

export function buildReceipt(store, workflowId) {
  const workflow = inspectWorkflow(store, workflowId);
  const receipt = {
    receiptVersion: 'capt-guardian/0.1',
    workflowId: workflow.workflowId,
    intent: workflow.intent,
    scenario: workflow.scenario,
    generatedAt: utcNow(),
    evidence: workflow.evidence,
    actions: workflow.actions,
    approvalRequests: workflow.approvalRequests ?? [],
    approvals: workflow.approvals,
    executions: workflow.executions,
    summary: {
      evidenceCount: workflow.evidence.length,
      proposedCount: workflow.actions.length,
      pendingApprovalCount: (workflow.approvalRequests ?? []).filter((a) => a.status === 'PENDING').length,
      approvedCount: workflow.approvals.filter((a) => a.decision === 'APPROVE').length,
      deniedCount: workflow.approvals.filter((a) => a.decision === 'DENY').length,
      executedCount: workflow.executions.filter((e) => e.status === 'executed').length,
      unresolvedActions: workflow.actions.filter((a) => !['EXECUTED', 'DENIED'].includes(a.status)).map((a) => a.actionId),
    },
  };
  receipt.receiptDigest = digest(receipt);
  return receipt;
}
