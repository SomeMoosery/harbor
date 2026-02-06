import { createHash } from 'node:crypto';

function stable(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stable(v));
  const sortedKeys = Object.keys(value).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    result[key] = stable(value[key]);
  }
  return result;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(stable(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}
