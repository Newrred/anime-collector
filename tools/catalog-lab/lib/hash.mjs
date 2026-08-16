import { createHash } from 'node:crypto';

function serialize(value) {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError('Value must be JSON serializable');
    return serialized;
  }
  if (Array.isArray(value)) return `[${value.map((item) => serialize(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${serialize(value[key])}`
  )).join(',')}}`;
}

export function stableStringify(value) {
  return serialize(value);
}

export function sha256(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
