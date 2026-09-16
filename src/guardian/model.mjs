import { createHash } from 'node:crypto';

export const EvidenceKind = Object.freeze({
  OBSERVATION: 'OBSERVATION', FACT: 'FACT', INFERENCE: 'INFERENCE',
  UNCERTAINTY: 'UNCERTAINTY', COMPETING_EXPLANATION: 'COMPETING_EXPLANATION',
});
export const Consequence = Object.freeze({
  INFORMATIONAL: 'INFORMATIONAL', REVERSIBLE_LOCAL: 'REVERSIBLE_LOCAL', CONSEQUENTIAL: 'CONSEQUENTIAL',
});
export const ApprovalDecision = Object.freeze({ APPROVE: 'APPROVE', DENY: 'DENY' });
export class AuthorityDenied extends Error {}
export class ExecutionUnavailable extends Error {}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
export function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}
export const utcNow = () => new Date().toISOString();
export function assertEnum(value, enumeration, label) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`invalid_${label}:${value}`);
}
