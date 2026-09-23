import { pathToFileURL } from 'node:url';

export function assessHealthRuns(runs, now = Date.now(), maxAgeHours = 36) {
  const latest = [...runs].filter((run) => run.event === 'schedule' || run.event === 'workflow_dispatch')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (!latest) return { ok: false, code: 'HEALTH_NEVER_RAN' };
  const ageHours = (now - Date.parse(latest.created_at)) / 3600000;
  if (!Number.isFinite(ageHours) || ageHours < 0 || ageHours > maxAgeHours) return { ok: false, code: 'HEALTH_STALE' };
  if (latest.status !== 'completed') return { ok: false, code: 'HEALTH_NOT_COMPLETED' };
  if (latest.conclusion !== 'success') return { ok: false, code: 'HEALTH_FAILED' };
  return { ok: true, code: 'HEALTH_RECENT_SUCCESS', runId: latest.id, ageHours: Math.round(ageHours * 10) / 10 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let report;
  try {
    const repo = process.env.GITHUB_REPOSITORY;
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo || '')) throw new Error('CONFIG_INVALID');
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/catalog-health.yml/runs?branch=master&per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('HEALTH_HISTORY_UNAVAILABLE');
    const body = await response.json();
    if (!Array.isArray(body.workflow_runs)) throw new Error('HEALTH_HISTORY_INVALID');
    report = assessHealthRuns(body.workflow_runs);
  } catch { report = { ok: false, code: 'HEALTH_HISTORY_UNAVAILABLE' }; }
  process.stdout.write(`${JSON.stringify({ ...report, checkedAt: new Date().toISOString() })}\n`);
  if (!report.ok) process.exitCode = 1;
}
