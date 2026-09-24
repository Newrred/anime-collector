import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHECKS = ['unit', 'catalog', 'browser', 'sql', 'build', 'android'];
const GATES = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'];
// Local evidence integrity check only; it does not configure branch protection or deploy.
export async function checkReleaseCandidate(candidate, { head, dirty, verifyEvidence }) {
  const blockers = [];
  if (!/^[a-f0-9]{40}$/.test(candidate?.sourceCommit ?? '') || candidate.sourceCommit !== head) blockers.push('SOURCE_COMMIT_MISMATCH');
  if (dirty) blockers.push('SOURCE_NOT_CLEAN');
  for (const id of CHECKS) {
    const check = candidate?.checks?.[id];
    if (check?.status !== 'PASS' || check.sourceCommit !== head || check.failed !== 0 || !(check.passed > 0)
      || !Number.isSafeInteger(check.passed) || !Number.isSafeInteger(check.skipped) || check.skipped < 0
      || (check.skipped > 0 && !check.skipReason?.trim())) blockers.push(`CHECK_${id}_INCOMPLETE`);
    else if (!await verifyEvidence(check.evidence)) blockers.push(`CHECK_${id}_EVIDENCE_INVALID`);
  }
  for (const id of GATES) {
    const gate = candidate?.gates?.[id];
    if (gate?.status !== 'VERIFIED' || !gate.verifiedBy?.trim()) blockers.push(`GATE_${id}_PENDING`);
    else if (!await verifyEvidence(gate.evidence)) blockers.push(`GATE_${id}_EVIDENCE_INVALID`);
  }
  if (!candidate?.catalogRelease?.id || !/^[a-f0-9]{64}$/.test(candidate.catalogRelease.hash ?? '')) blockers.push('CATALOG_VERSION_MISSING');
  if (!await verifyEvidence(candidate?.configurationEvidence)) blockers.push('CONFIGURATION_EVIDENCE_MISSING');
  return { ready: blockers.length === 0, blockers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('CANDIDATE_FILE_REQUIRED');
    const root = await realpath(process.cwd());
    const candidate = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const verifyEvidence = async (evidence) => {
      try {
        if (!evidence?.path || !/^[a-f0-9]{64}$/.test(evidence.sha256 ?? '')) return false;
        const resolved = await realpath(path.resolve(root, evidence.path));
        const relative = path.relative(root, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
        return createHash('sha256').update(await readFile(resolved)).digest('hex') === evidence.sha256;
      } catch { return false; }
    };
    const result = await checkReleaseCandidate(candidate, {
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()), verifyEvidence,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ready ? 0 : 2;
  } catch { process.stderr.write('CANDIDATE_CHECK_FAILED\n'); process.exitCode = 1; }
}
