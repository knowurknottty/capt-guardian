import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApprovalDecision, AuthorityDenied, Consequence, EvidenceKind, GuardianService,
} from '../src/guardian/service.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'capt-guardian-'));
  const statePath = join(root, 'state.json');
  const executionPath = join(root, 'execution.jsonl');
  return { root, statePath, executionPath, service: new GuardianService(statePath, executionPath) };
}

test('consequential action fails closed until exact approval, then executes once', () => {
  const { service, executionPath } = fixture();
  const workflow = service.startWorkflow('Prepare household', 'severe_weather');
  service.addEvidence(workflow.workflowId, EvidenceKind.INFERENCE, 'Interior shelter is preferable.', 'planner:v1', { basedOn: ['ev_source'] }, 0.8);
  const action = service.proposeAction(workflow.workflowId, 'household.plan.commit', 'Commit emergency plan', Consequence.CONSEQUENTIAL, { plan: ['move to shelter'] });

  assert.throws(() => service.executeAction(workflow.workflowId, action.actionId), /approval_required/);
  const approval = service.recordApproval(workflow.workflowId, action.actionId, 'captain', ApprovalDecision.APPROVE, 'Reviewed.');
  const execution = service.executeAction(workflow.workflowId, action.actionId);

  assert.equal(execution.status, 'executed');
  assert.equal(execution.authority.approvalId, approval.approvalId);
  assert.equal(execution.actionDigest, action.actionDigest);
  assert.equal(JSON.parse(readFileSync(executionPath, 'utf8').trim()).actionDigest, action.actionDigest);
});

test('approval is single-use and receipt preserves epistemic type', () => {
  const { service } = fixture();
  const workflow = service.startWorkflow('Prepare household');
  const evidence = service.addEvidence(workflow.workflowId, EvidenceKind.INFERENCE, 'Generator may be needed.', 'planner:v1', { sourceIds: ['weather-1'] }, 0.6);
  const action = service.proposeAction(workflow.workflowId, 'household.plan.commit', 'Commit plan', Consequence.CONSEQUENTIAL, { generator: false });
  service.recordApproval(workflow.workflowId, action.actionId, 'captain', ApprovalDecision.APPROVE);
  service.executeAction(workflow.workflowId, action.actionId);

  assert.throws(() => service.executeAction(workflow.workflowId, action.actionId), /approval_consumed/);
  const receipt = service.buildReceipt(workflow.workflowId);
  assert.equal(receipt.evidence.find((item) => item.evidenceId === evidence.evidenceId).kind, EvidenceKind.INFERENCE);
  assert.equal(receipt.summary.executedCount, 1);
  assert.match(receipt.receiptDigest, /^sha256:[0-9a-f]{64}$/);
});

test('explicit denial blocks execution and remains visible in receipt', () => {
  const { service } = fixture();
  const workflow = service.startWorkflow('Prepare household');
  const action = service.proposeAction(workflow.workflowId, 'contact.send', 'Send household alert', Consequence.CONSEQUENTIAL, { recipients: ['family'] });
  service.recordApproval(workflow.workflowId, action.actionId, 'captain', ApprovalDecision.DENY, 'Do not send yet.');

  assert.throws(() => service.executeAction(workflow.workflowId, action.actionId), /approval_denied/);
  const receipt = service.buildReceipt(workflow.workflowId);
  assert.equal(receipt.summary.deniedCount, 1);
  assert.equal(receipt.summary.executedCount, 0);
});

test('post-approval action mutation invalidates authority binding', () => {
  const { service, statePath } = fixture();
  const workflow = service.startWorkflow('Prepare household');
  const action = service.proposeAction(workflow.workflowId, 'contact.send', 'Send household alert', Consequence.CONSEQUENTIAL, { recipients: ['family'] });
  service.recordApproval(workflow.workflowId, action.actionId, 'captain', ApprovalDecision.APPROVE);

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.workflows[workflow.workflowId].actions[0].payload.recipients.push('unexpected-recipient');
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });

  assert.throws(() => service.executeAction(workflow.workflowId, action.actionId), /action_digest_mismatch/);
});
