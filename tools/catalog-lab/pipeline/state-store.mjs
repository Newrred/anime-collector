import { readFile } from 'node:fs/promises';

import { atomicWriteJson } from '../lib/atomic-json.mjs';
import { toPathKey } from '../lib/path-key.mjs';

function statePath(workspace, sourceId, targetKey) {
  return workspace.resolve('state', toPathKey(sourceId), `${toPathKey(targetKey)}.json`);
}

export function createStateStore({ workspace }) {
  return Object.freeze({
    async read({ sourceId, targetKey }) {
      try {
        return JSON.parse(await readFile(statePath(workspace, sourceId, targetKey), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async write({ sourceId, targetKey, state }) {
      const path = statePath(workspace, sourceId, targetKey);
      const value = { ...state, sourceId, targetKey };
      await atomicWriteJson(path, value);
      return Object.freeze({ ...value, path });
    },
  });
}
