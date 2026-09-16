import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthorityDenied, GuardianService } from '../src/guardian/service.mjs';

test('workflow ownership rejects a different OAuth principal', () => {
  const root = mkdtempSync(join(tmpdir(), 'capt-guardian-tenant-'));
  const service = new GuardianService(join(root, 'state.json'), join(root, 'execution.jsonl'));
  const workflow = service.startWorkflow('Prepare household', 'severe_weather', 'oauth:user-a');
  assert.equal(workflow.ownerPrincipal, 'oauth:user-a');
  assert.throws(
    () => service.inspectWorkflow(workflow.workflowId, 'oauth:user-b'),
    (error) => error instanceof AuthorityDenied && error.message === 'workflow_principal_mismatch',
  );
  assert.equal(service.inspectWorkflow(workflow.workflowId, 'oauth:user-a').workflowId, workflow.workflowId);
});
