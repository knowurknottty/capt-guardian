import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class JsonStateStore {
  constructor(path) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) this.write({ workflows: {} });
  }

  read() {
    return JSON.parse(readFileSync(this.path, 'utf8'));
  }

  write(state) {
    const temp = `${this.path}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temp, this.path);
  }

  update(mutator) {
    const state = this.read();
    const result = mutator(state);
    this.write(state);
    return structuredClone(result);
  }

  workflow(state, workflowId) {
    const workflow = state.workflows[workflowId];
    if (!workflow) throw new RangeError(`workflow_not_found:${workflowId}`);
    return workflow;
  }
}
