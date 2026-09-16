import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { actionBinding, findAction } from './action.mjs';
import { latestApproval } from './approval.mjs';
import { ApprovalDecision, AuthorityDenied, Consequence, digest, utcNow } from './model.mjs';

export class JsonlActionExecutor {
  constructor(path) {
    this.path = path;
    this.identity = `jsonl:${path}`;
    mkdirSync(dirname(path), { recursive: true });
  }

  execute(action, authority) {
    const record = {
      sideEffectId: `fx_${randomUUID()}`,
      actionId: action.actionId,
      actionDigest: action.actionDigest,
      capability: action.capability,
      payload: structuredClone(action.payload),
      authority: structuredClone(authority),
      executedAt: utcNow(),
    };
    appendFileSync(this.path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    return { status: 'executed', sideEffectId: record.sideEffectId, sink: this.identity };
  }
}

export function executeAction(store, workflowId, actionId, executor) {
  return store.update((state) => {
    const workflow = store.workflow(state, workflowId);
    const action = findAction(workflow, actionId);
    if (digest(actionBinding(action)) !== action.actionDigest) throw new AuthorityDenied('action_digest_mismatch');

    const approval = latestApproval(workflow, actionId);
    if (action.consequence === Consequence.CONSEQUENTIAL) {
      if (!approval) throw new AuthorityDenied('approval_required');
      if (approval.decision !== ApprovalDecision.APPROVE) throw new AuthorityDenied('approval_denied');
      if (approval.consumedAt) throw new AuthorityDenied('approval_consumed');
      if (approval.actionDigest !== action.actionDigest) throw new AuthorityDenied('approval_digest_mismatch');
    }

    const startedAt = utcNow();
    const authority = approval ? {
      approvalId: approval.approvalId,
      approvalDigest: approval.approvalDigest,
      principal: approval.principal,
      actionDigest: approval.actionDigest,
    } : { mode: 'policy_no_human_approval_required', actionDigest: action.actionDigest };
    const result = executor.execute(action, authority);
    const execution = {
      executionId: `exec_${randomUUID()}`, workflowId, actionId,
      actionDigest: action.actionDigest, authority, executorIdentity: executor.identity,
      startedAt, finishedAt: utcNow(), status: result.status, result,
    };
    execution.executionDigest = digest(execution);
    workflow.executions.push(execution);
    action.status = 'EXECUTED';
    if (approval) approval.consumedAt = execution.finishedAt;
    return execution;
  });
}
