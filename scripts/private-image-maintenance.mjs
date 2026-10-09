import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// These thresholds alert before the approved production limits (100 MB / 500 MB).
// They do not change or replace the database's enforced policy.
export function evaluatePrivateCapacity(value, { storageAlertBytes = 80_000_000, readAlertBytes = 400_000_000, now = Date.now() } = {}) {
  const integers = [value?.storedBytes, value?.reservedBytes, value?.globalReadBytes];
  const observedAt = Date.parse(value?.observedAt);
  if (integers.some(n => !Number.isSafeInteger(n) || n < 0)
      || !Number.isFinite(observedAt) || observedAt > now + 60_000 || now - observedAt > 10 * 60_000
      || ![storageAlertBytes, readAlertBytes].every(n => Number.isSafeInteger(n) && n > 0)) {
    throw new Error('INVALID_CAPACITY_OBSERVATION');
  }
  const storageBytes = Math.max(value.storedBytes, value.reservedBytes);
  const alerts = [];
  if (storageBytes >= storageAlertBytes) alerts.push('PRIVATE_STORAGE_NEAR_LIMIT');
  if (value.globalReadBytes >= readAlertBytes) alerts.push('PRIVATE_MONTHLY_READ_NEAR_LIMIT');
  return { observedAt: new Date(observedAt).toISOString(), storageBytes, readBytes: value.globalReadBytes,
    storageAlertBytes, readAlertBytes, alerts };
}

export async function runPrivateMaintenance(env, fetchImpl = fetch) {
  let origin;
  try { origin = new URL(env.CLEANUP_ORIGIN); } catch { throw new Error('INVALID_MAINTENANCE_CONFIGURATION'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/'
      || origin.search || origin.hash || typeof env.CLEANUP_SECRET !== 'string' || env.CLEANUP_SECRET.length < 32) {
    throw new Error('INVALID_MAINTENANCE_CONFIGURATION');
  }
  const call = async endpoint => {
    const response = await fetchImpl(new URL(endpoint, origin), { headers: { Authorization: `Bearer ${env.CLEANUP_SECRET}` },
      redirect: 'error', signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`MAINTENANCE_HTTP_${response.status}`);
    return response.json();
  };
  // Cleanup failure must not prevent capacity observation; report both results.
  const cleanupSkipped = env.OBSERVE_ONLY === 'true';
  let cleanup, cleanupFailed = false;
  if (!cleanupSkipped) {
    try {
      cleanup = await call('/api/private-image-cleanup');
      if (!Number.isInteger(cleanup.deleted) || cleanup.deleted < 0 || cleanup.deleted > 50 || cleanup.failed !== 0) throw new Error();
    } catch { cleanupFailed = true; }
  }
  const capacity = evaluatePrivateCapacity(await call('/api/private-image-observe'), {
    storageAlertBytes: env.STORAGE_ALERT_BYTES ? Number(env.STORAGE_ALERT_BYTES) : 80_000_000,
    readAlertBytes: env.READ_ALERT_BYTES ? Number(env.READ_ALERT_BYTES) : 400_000_000,
  });
  return { deleted: cleanupSkipped || cleanupFailed ? null : cleanup.deleted, cleanupSkipped, cleanupFailed, ...capacity };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runPrivateMaintenance(process.env);
    console.log(JSON.stringify(result));
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY,
        `## Private image capacity\n\nObserved: ${result.observedAt}\n\nStorage/reservations: ${result.storageBytes} bytes (alert ${result.storageAlertBytes})\n\nMonthly reads: ${result.readBytes} bytes (alert ${result.readAlertBytes})\n\nCleanup: ${result.cleanupSkipped ? 'SKIPPED (manual observation)' : result.cleanupFailed ? 'FAILED' : `${result.deleted} retired representations removed`}\n\nAlerts: ${result.alerts.join(', ') || 'none'}\n`);
    }
    for (const code of [...result.alerts, ...(result.cleanupFailed ? ['PRIVATE_CLEANUP_FAILED'] : [])]) console.error(`::error::${code}`);
    if (result.cleanupFailed || result.alerts.length) process.exitCode = 1;
  } catch {
    // Fetch/JSON errors can contain URLs or response data: never echo them.
    console.error('::error::PRIVATE_MAINTENANCE_FAILED');
    process.exitCode = 1;
  }
}
