import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityDenied, Consequence, GuardianService } from '../src/guardian/service.mjs';
import { createGuardianHttpServer } from '../src/http.mjs';

async function startFixture() {
  const root = mkdtempSync(join(tmpdir(), 'capt-guardian-human-'));
  const service = new GuardianService(join(root, 'state.json'), join(root, 'executions.jsonl'));
  const app = createGuardianHttpServer({
    service,
    humanApprovalToken: 'test-human-secret-32-bytes-long-0001',
    humanPrincipal: 'human:test-operator',
    onerror: () => {},
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  return { app, service, baseUrl: `http://127.0.0.1:${address.port}` };
}

test('human approval channel requires separate authentication and exact digest', async () => {
  const { app, service, baseUrl } = await startFixture();
  try {
    const workflow = service.startWorkflow('Prepare household', 'severe_weather');
    const action = service.proposeAction(
      workflow.workflowId, 'contact.send', 'Send household alert',
      Consequence.CONSEQUENTIAL, { recipients: ['family'] },
    );
    assert.throws(
      () => service.executeAction(workflow.workflowId, action.actionId),
      (error) => error instanceof AuthorityDenied && error.message === 'approval_required',
    );

    const unauth = await fetch(`${baseUrl}/human/approvals`);
    assert.equal(unauth.status, 401);
    const authHeaders = { authorization: 'Bearer test-human-secret-32-bytes-long-0001' };
    const pendingResponse = await fetch(`${baseUrl}/human/approvals`, { headers: authHeaders });
    assert.equal(pendingResponse.status, 200);
    const pending = await pendingResponse.json();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].actionDigest, action.actionDigest);

    const requestId = pending[0].approvalRequestId;
    const wrong = await fetch(`${baseUrl}/human/approvals/${requestId}/decision`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'APPROVE', actionDigest: 'sha256:' + '0'.repeat(64) }),
    });
    assert.equal(wrong.status, 409);
    assert.throws(() => service.executeAction(workflow.workflowId, action.actionId), /approval_required/);

    const accepted = await fetch(`${baseUrl}/human/approvals/${requestId}/decision`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'APPROVE', actionDigest: action.actionDigest, rationale: 'Reviewed exact action.' }),
    });
    assert.equal(accepted.status, 200);
    const approval = await accepted.json();
    assert.equal(approval.principal, 'human:test-operator');
    assert.equal(approval.actionDigest, action.actionDigest);

    const execution = service.executeAction(workflow.workflowId, action.actionId);
    assert.equal(execution.status, 'executed');
  } finally {
    await app.close();
  }
});
