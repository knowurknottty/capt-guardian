import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApprovalDecision, Consequence, EvidenceKind, GuardianService } from '../src/guardian/service.mjs';
import { createGuardianMcpHandler } from '../src/mcp.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'capt-guardian-mcp-'));
  const service = new GuardianService(join(root, 'state.json'), join(root, 'execution.jsonl'));
  const handler = createGuardianMcpHandler(service);
  return { root, service, handler };
}

async function rpc(handler, body, protocolVersion) {
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (protocolVersion) headers['mcp-protocol-version'] = protocolVersion;
  const response = await handler.fetch(new Request('http://localhost/mcp', {
    method: 'POST', headers, body: JSON.stringify(body),
  }));
  const contentType = response.headers.get('content-type') ?? '';
  let payload;
  if (contentType.includes('text/event-stream')) {
    const body = await response.text();
    const messages = body.split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => JSON.parse(line.slice(5).trim()));
    payload = messages.at(-1);
  } else {
    payload = await response.json();
  }
  return { response, payload };
}

test('negotiates Alexa+ required 2025-11-25 protocol', async () => {
  const { handler } = fixture();
  const { response, payload } = await rpc(handler, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2025-11-25', capabilities: {},
      clientInfo: { name: 'guardian-test', version: '1.0.0' },
    },
  });
  assert.equal(response.status, 200);
  assert.equal(payload.result.protocolVersion, '2025-11-25');
  await handler.close();
});

test('MCP tool surface cannot manufacture human approval', async () => {
  const { handler } = fixture();
  const { payload } = await rpc(handler, {
    jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
  }, '2025-11-25');
  const names = payload.result.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    'guardian_add_evidence', 'guardian_execute_action', 'guardian_get_receipt',
    'guardian_inspect_workflow', 'guardian_propose_action', 'guardian_start_workflow',
  ]);
  assert.equal(names.some((name) => /approv|authoriz|decision/i.test(name)), false);
  await handler.close();
});

test('consequential execution blocks until separate human decision exists', async () => {
  const { handler, service } = fixture();
  let result = (await rpc(handler, {
    jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
      name: 'guardian_start_workflow', arguments: { intent: 'Prepare household', scenario: 'severe_weather' },
    },
  }, '2025-11-25')).payload.result.structuredContent;
  const workflowId = result.workflowId;

  result = (await rpc(handler, {
    jsonrpc: '2.0', id: 4, method: 'tools/call', params: {
      name: 'guardian_add_evidence', arguments: {
        workflowId, kind: EvidenceKind.INFERENCE, claim: 'Interior shelter is preferable.',
        sourceIdentity: 'planner:v1', provenance: { basedOn: ['weather-source'] }, confidence: 0.8,
      },
    },
  }, '2025-11-25')).payload.result.structuredContent;
  assert.equal(result.kind, EvidenceKind.INFERENCE);

  const action = (await rpc(handler, {
    jsonrpc: '2.0', id: 5, method: 'tools/call', params: {
      name: 'guardian_propose_action', arguments: {
        workflowId, capability: 'household.plan.commit', summary: 'Commit emergency plan',
        consequence: Consequence.CONSEQUENTIAL, payload: { plan: ['move to interior shelter'] },
      },
    },
  }, '2025-11-25')).payload.result.structuredContent;

  let execution = (await rpc(handler, {
    jsonrpc: '2.0', id: 6, method: 'tools/call', params: {
      name: 'guardian_execute_action', arguments: { workflowId, actionId: action.actionId },
    },
  }, '2025-11-25')).payload.result.structuredContent;
  assert.deepEqual(execution.status, 'blocked');
  assert.equal(execution.reason, 'approval_required');

  service.recordApproval(workflowId, action.actionId, 'human:test', ApprovalDecision.APPROVE, 'Reviewed exact action.');

  execution = (await rpc(handler, {
    jsonrpc: '2.0', id: 7, method: 'tools/call', params: {
      name: 'guardian_execute_action', arguments: { workflowId, actionId: action.actionId },
    },
  }, '2025-11-25')).payload.result.structuredContent;
  assert.equal(execution.status, 'executed');
  assert.equal(execution.actionDigest, action.actionDigest);

  const receipt = (await rpc(handler, {
    jsonrpc: '2.0', id: 8, method: 'tools/call', params: {
      name: 'guardian_get_receipt', arguments: { workflowId },
    },
  }, '2025-11-25')).payload.result.structuredContent;
  assert.equal(receipt.summary.executedCount, 1);
  assert.equal(receipt.summary.approvedCount, 1);
  assert.equal(receipt.evidence[0].kind, EvidenceKind.INFERENCE);
  await handler.close();
});
