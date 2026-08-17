# Windows Cover Safe Storage Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reviewed Windows-only local cover persistence backend that preserves the existing CoverRecord trust boundary and safely publishes immutable checksum files inside the external `TEST_ONLY` workspace without following reparse points.

**Architecture:** A hidden Windows PowerShell 5.1 broker loads one tracked C# source file with `Add-Type`, then serves a bounded binary protocol over anonymous stdin/stdout pipes. The C# core pins every path component with documented Win32 handles, rejects all reparse points, publishes a fully flushed temporary file with `FileRenameInfo` and `ReplaceIfExists=FALSE`, and verifies every collision. The preferred publication is handle-relative; on this host the user has approved a narrowly scoped fallback to a volume-GUID canonical absolute target derived from the retained final-parent handle, but only after a native Windows-SDK control reproduces relative-root error 87 and all direct reparse/identity gates pass.

**Tech Stack:** Node.js 22+ ESM and `node:test`, Windows PowerShell 5.1 Desktop, .NET Framework CLR 4.x `Add-Type`, C# P/Invoke to documented Kernel32 file APIs, local fixed NTFS, existing synthetic JPEG/PNG/WebP fixtures, no new npm or NuGet dependency.

## Global Constraints

- The approved source of truth remains `docs/superpowers/specs/2026-08-17-three-source-local-catalog-lab-design.md`; this plan supplements but does not edit that design or `docs/moemoa/plans/2026-08-17-three-source-local-catalog-lab.md`.
- Treat `.superpowers/sdd/2026-08-17-three-source-local-catalog-lab/windows-cover-backend-design-report.md` as the Windows backend design input.
- Actual payloads and covers remain only under an absolute `MOEMOA_CATALOG_LAB_DIR` outside every Git worktree and behind the exact `TEST_ONLY.json` sentinel.
- Do not run network collection, do not use real cover bytes, and do not create a 3,998-item run. Tests use only `tests/catalog-lab/fixtures/cover-valid-images.mjs` synthetic bytes.
- Do not add or change npm production/dev dependencies, NuGet packages, a `.csproj`, `global.json`, tracked DLL/EXE, service, installer, registry setting, scheduled task, or administrative requirement.
- Do not place helper binaries, cover bytes, workspace payloads, `TEST_ONLY.json`, or local absolute workspace paths in Git, `dist`, Android assets/APK, Vercel output, CI artifacts, test attachments, or tester deliverables.
- Windows scope is x64 Windows PowerShell 5.1 on a local fixed NTFS volume. Fail closed on UNC/SMB, device namespaces, subst/network/removable drives, FAT/exFAT, ReFS, WSL paths, volume mount points, cloud placeholders, and any reparse tag.
- The broker accepts at most 100 sequential requests; each header is 1..4096 bytes and each raw body is 1..8,388,608 bytes.
- The destination is derived only as `images/covers/anime-<uuid>/<sha256>.<jpg|png|webp>`. No caller supplies a filename, `localRef`, or arbitrary path segment.
- Every directory/file component is opened with `FILE_FLAG_OPEN_REPARSE_POINT`; every reparse point is rejected; validated directory handles stay open with `FILE_SHARE_READ` only while descending and mutating. Both `FILE_SHARE_WRITE` and `FILE_SHARE_DELETE` are omitted so a second write-capable handle cannot mutate reparse metadata in place or replace a pinned component.
- The final publication is same-directory and same-volume through `SetFileInformationByHandle(FileRenameInfo)` with `ReplaceIfExists=FALSE`. Prefer a pinned `RootDirectory` plus a simple relative checksum filename. If and only if a temporary native Windows-SDK oracle also reproduces Win32 87 for that documented form, the accepted fallback is a normalized `VOLUME_NAME_GUID` absolute target derived from the retained final-parent handle plus the fixed checksum leaf. Never use the request's DOS path spelling, `MoveFileEx`, `CREATE_ALWAYS`, replacement rename, hard-link publication, or any overwrite fallback.
- Every accepted full-path publication keeps the entire `FILE_SHARE_READ`-only pin chain and temp handle open through rename, then reopens the destination no-follow, compares NTFS volume/file identity with the still-open temp handle, and recomputes exact size and SHA-256 before success.
- Existing destinations are never trusted by name. Open no-follow with no write/delete sharing, require a bounded regular non-reparse file, and recompute exact byte length and SHA-256 before returning `EXISTING`; otherwise return `COVER_STORE_COLLISION`.
- The helper never creates, downloads, decodes, brands, upgrades, or selects a CoverRecord. Only existing private `COVER_RECORDS`, `PRODUCTION_COVER_RECORDS`, and `COVER_BYTES` state in `covers.mjs` controls production eligibility.
- Rights remain `rightsStatus='TEST_ONLY_UNKNOWN'` and `distributionStatus='PROHIBITED'`; no production promotion or redistribution is authorized.
- Task 1 leaves all `covers.mjs` Windows storage paths fail-closed. Task 2 may begin only after Task 1 tests and independent review pass.
- If PowerShell, `Add-Type`, the protocol, any native check, any filesystem check, any required Windows test, or either independent review fails, Windows remains `COVER_STORAGE_PLATFORM_UNSAFE`/fail-closed with no POSIX fallback.
- Task 8 of the original catalog plan remains blocked until both tasks in this plan pass their tests and independent reviews.
- Security claim: after acceptance, the backend provides no-follow component pinning, no intentional overwrite, concurrency-safe checksum publication, and collision verification against unprivileged namespace swaps during the operation.
- Security non-claims: it does not defend against an administrator/kernel/filesystem filter, trusted helper or Node compromise, a same-user attacker already holding sufficiently privileged incompatible handles, post-return workspace mutation, or raw-volume access.
- Durability claim: file data is written completely and `FlushFileBuffers` is requested before and after same-directory publication.
- Durability non-claim: Microsoft does not document a portable directory-entry fsync or universal power-loss transaction for these APIs; do not describe the result as guaranteed to survive every power cut or hardware cache failure.

---

### Task 1: Isolated Windows broker, native core, Node protocol wrapper, and real Windows tests

Task 1 proves the backend without changing `tools/catalog-lab/pipeline/covers.mjs`. At its review boundary, production and fixture storage must still throw `COVER_STORAGE_PLATFORM_UNSAFE` on Windows exactly as current HEAD does.

**Files:**
- Create: `tools/catalog-lab/windows/cover-store-native.cs` — strict frame parser, workspace verifier, pinned Win32 handles, immutable publication, collision verification, and stable response codes.
- Create: `tools/catalog-lab/windows/cover-store-broker.ps1` — small PowerShell 5.1 loader that compiles the adjacent C# source once and delegates stdin/stdout to it.
- Create: `tools/catalog-lab/lib/windows-cover-store.mjs` — hidden child lifecycle, frame encoder/response validator, caps/timeouts, and low-level broker API.
- Create: `tests/catalog-lab/windows-cover-storage.test.mjs` — Windows-only protocol, interop, reparse, lock, collision, cleanup, concurrency, and lifecycle tests using synthetic bytes.
- Read without modifying: `tools/catalog-lab/pipeline/covers.mjs`, `tools/catalog-lab/lib/workspace.mjs`, `tests/catalog-lab/fixtures/cover-valid-images.mjs`.

**Interfaces:**
- Consumes: absolute `repoRoot` and `workspaceRoot` strings for isolated testing, `animeId` matching `^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, lowercase SHA-256, `jpg|png|webp`, and a `Uint8Array` of at most 8 MiB.
- Produces from `tools/catalog-lab/lib/windows-cover-store.mjs`:

```js
export const WINDOWS_COVER_STORE_LIMITS = Object.freeze({
  headerBytes: 4_096,
  bodyBytes: 8 * 1024 * 1024,
  requestsPerProcess: 100,
  startupTimeoutMs: 15_000,
  requestTimeoutMs: 30_000,
  idleTimeoutMs: 30_000,
  shutdownTimeoutMs: 2_000,
  lifetimeMs: 10 * 60_000,
  stdoutLineBytes: 4_096,
  stdoutTotalBytes: 512 * 1024,
  stderrTotalBytes: 8 * 1024,
});

export function createWindowsCoverStoreBroker({
  spawnImpl,
  powershellPath,
  brokerScriptUrl,
  limits,
} = {}) {
  return Object.freeze({
    ready, // (): Promise<void>
    store, // (request: WindowsCoverStoreRequest): Promise<WindowsCoverStoreResult>
    close, // (): Promise<void>
  });
}

// WindowsCoverStoreRequest
// { requestId, repoRoot, workspaceRoot, animeId, checksum, extension, bytes }
// WindowsCoverStoreResult
// { status:'CREATED'|'EXISTING', localRef, checksum, byteSize }
```

- The low-level broker API cannot mint trust. It returns only storage observations and is not imported by `covers.mjs` in Task 1.
- The production protocol has one operation only: store the exact framed cover. It has no lock command, test command, record-brand command, arbitrary read command, arbitrary delete command, or arbitrary relative-path command.

**Exact protocol:**

Each input frame is `uint32-le headerByteLength`, the strict UTF-8 header, then exactly `bodyByteLength` raw bytes. The header has exactly eight LF-terminated ASCII fields:

```text
MOEMOA-COVER-STORE/1
<request UUID>
<base64url UTF-8 repoRoot>
<base64url UTF-8 workspaceRoot>
<anime:UUID-v4>
<64 lowercase hex SHA-256>
<jpg|png|webp>
<decimal bodyByteLength>
```

The C# core validates the complete bounded frame, reads the exact body, rejects trailing/short data within the frame, recomputes SHA-256, and checks the JPEG/PNG/WebP magic before the first workspace-native call. General JSON is not accepted on input.

Clean EOF before a new four-byte frame prefix ends the broker successfully; EOF after any partial prefix, header, or body is `COVER_STORAGE_PROTOCOL_INVALID`. Stdout is one ready line followed by one bounded JSON line per request:

```json
{"v":1,"ready":true}
{"v":1,"requestId":"11111111-1111-4111-8111-111111111111","ok":true,"status":"CREATED","localRef":"images/covers/anime-11111111-1111-4111-8111-111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png","checksum":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","byteSize":67}
{"v":1,"requestId":"11111111-1111-4111-8111-111111111111","ok":false,"code":"COVER_STORAGE_REPARSE_FORBIDDEN","win32":4390}
```

Allowed stable error codes are:

```text
COVER_STORAGE_INPUT_INVALID
COVER_STORAGE_PROTOCOL_INVALID
COVER_STORAGE_HELPER_UNAVAILABLE
COVER_STORAGE_HELPER_TIMEOUT
COVER_STORAGE_HELPER_PROTOCOL
COVER_STORAGE_PATH_INVALID
COVER_STORAGE_FILESYSTEM_UNSUPPORTED
COVER_STORAGE_WORKSPACE_OVERLAP
COVER_STORAGE_WORKSPACE_INVALID
COVER_STORAGE_SENTINEL_INVALID
COVER_STORAGE_REPARSE_FORBIDDEN
COVER_STORAGE_SHARING_VIOLATION
COVER_STORAGE_IO_FAILED
COVER_STORE_COLLISION
```

Responses never contain an absolute path, source URL, image bytes, title, stack trace, or free-form exception text. The Node wrapper checks request ID, schema, exact derived `localRef`, digest, and size before resolving.

The C# broker serializes these fixed ASCII-only response fields itself; it does not add a JSON/NuGet assembly dependency or serialize arbitrary exception messages.

- [ ] **Step 1: Write the failing Node lifecycle and input-protocol tests**

Create the Windows-only test file with platform gating at the file level and private helpers `withSyntheticWorkspace()`, `sha256()`, `spawnRawBroker()`, and `withBroker()`. The first tests must import the missing wrapper and specify pre-access behavior:

```js
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  WINDOWS_COVER_STORE_LIMITS,
  createWindowsCoverStoreBroker,
} from '../../tools/catalog-lab/lib/windows-cover-store.mjs';
import { pngBytes } from './fixtures/cover-valid-images.mjs';

const windowsTest = process.platform === 'win32' ? test : test.skip;
const animeId = 'anime:11111111-1111-4111-8111-111111111111';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

windowsTest('rejects invalid metadata before touching a nonexistent workspace', async () => {
  const missing = join(tmpdir(), `moemoa-cover-missing-${randomUUID()}`);
  const broker = createWindowsCoverStoreBroker();
  await assert.rejects(broker.store({
    requestId: randomUUID(), repoRoot: resolve('.'), workspaceRoot: missing,
    animeId: '../outside', checksum: digest(pngBytes), extension: 'png', bytes: pngBytes,
  }), { code: 'COVER_STORAGE_INPUT_INVALID' });
  assert.equal(await stat(missing).then(() => true, () => false), false);
  await broker.close();
});

windowsTest('bounds helper output and fails closed when PowerShell is unavailable', async () => {
  const broker = createWindowsCoverStoreBroker({ powershellPath: join(tmpdir(), `missing-${randomUUID()}.exe`) });
  await assert.rejects(broker.ready(), { code: 'COVER_STORAGE_HELPER_UNAVAILABLE' });
  await broker.close();
  assert.equal(WINDOWS_COVER_STORE_LIMITS.bodyBytes, 8 * 1024 * 1024);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/catalog-lab/windows-cover-storage.test.mjs`

Expected on Windows: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/catalog-lab/lib/windows-cover-store.mjs`.  
Expected off Windows: the file is discovered but all Windows cases are explicitly skipped; off-Windows results do not satisfy Task 1 acceptance.

- [ ] **Step 3: Implement the bounded broker process and exact framing**

The PowerShell file must contain only the loader and stable top-level failure behavior:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$nativeSource = Join-Path $PSScriptRoot 'cover-store-native.cs'
try {
  Add-Type -Path $nativeSource -ErrorAction Stop
  $exitCode = [Moemoa.CatalogLab.WindowsCoverStore.CoverStoreBroker]::Run(
    [Console]::OpenStandardInput(),
    [Console]::OpenStandardOutput()
  )
  exit $exitCode
} catch {
  [Console]::Error.WriteLine('COVER_STORAGE_HELPER_UNAVAILABLE')
  exit 70
}
```

The Node wrapper must spawn the exact 64-bit system executable without a shell or execution-policy bypass:

```js
const defaultPowerShell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const child = spawnImpl(powershellPath ?? defaultPowerShell, [
  '-NoLogo', '-NoProfile', '-NonInteractive', '-File', fileURLToPath(brokerScriptUrl ?? defaultBrokerScriptUrl),
], {
  windowsHide: true,
  detached: false,
  shell: false,
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

Implement a single sequential request queue, a 15-second ready timeout, 30-second per-request timeout including stdin backpressure, 30-second idle timeout, 10-minute/100-request hard stop, two-second graceful shutdown, stdout line/total caps, and an 8 KiB stderr cap. Any timeout or protocol violation kills the broker, rejects all queued requests, and never retries a mutation automatically. Do not log stderr verbatim.

- [ ] **Step 4: Implement strict C# frame validation before native workspace access**

Use namespace `Moemoa.CatalogLab.WindowsCoverStore` and these focused internal units in the single tracked C# file:

```csharp
public static class CoverStoreBroker {
    public static int Run(Stream input, Stream output);
}

internal sealed class StoreRequest {
    internal Guid RequestId;
    internal string RepoRoot;
    internal string WorkspaceRoot;
    internal string AnimeId;
    internal string Checksum;
    internal string Extension;
    internal byte[] Body;
}

internal sealed class StoreResult {
    internal string Status;
    internal string LocalRef;
    internal string Checksum;
    internal int ByteSize;
}

internal static class FrameCodec {
    internal static StoreRequest ReadRequest(Stream input);
    internal static void WriteReady(Stream output);
    internal static void WriteSuccess(Stream output, Guid requestId, StoreResult result);
    internal static void WriteFailure(Stream output, Guid requestId, string code, int win32);
}

internal static class CoverStoreCore {
    internal static StoreResult Store(StoreRequest request);
}
```

`FrameCodec.ReadRequest()` must use checked arithmetic, strict `UTF8Encoding(false, true)`, exact eight-field parsing, anchored ASCII validation, Base64URL decoding, exact body reads, an 8 MiB ceiling before allocation, SHA-256 recomputation, and signature/extension agreement. It must complete all of this before calling `CoverStoreCore.Store()`.

- [ ] **Step 5: Run protocol/lifecycle tests and confirm GREEN for the first slice**

Run: `node --test --test-name-pattern="invalid metadata|helper output|PowerShell" tests/catalog-lab/windows-cover-storage.test.mjs`

Expected on Windows: PASS; the invalid-input workspace path is still absent, missing PowerShell produces `COVER_STORAGE_HELPER_UNAVAILABLE`, and the process exits without a visible window.

- [ ] **Step 6: Add failing native interop, junction, symlink, collision, cleanup, and concurrency tests**

Add a valid synthetic workspace helper that creates only the exact sentinel outside the repository. Add mandatory junction tests for the workspace root, `images`, `covers`, anime directory, and destination. Each trap must remain empty:

```js
windowsTest('rejects a covers junction without writing the external trap', async () => {
  await withSyntheticWorkspace(async ({ repoRoot, workspaceRoot }) => {
    const trap = await mkdtemp(join(tmpdir(), 'moemoa-cover-trap-'));
    await symlink(trap, join(workspaceRoot, 'images'), 'junction');
    const broker = createWindowsCoverStoreBroker();
    await assert.rejects(broker.store({
      requestId: randomUUID(), repoRoot, workspaceRoot, animeId,
      checksum: digest(pngBytes), extension: 'png', bytes: pngBytes,
    }), { code: 'COVER_STORAGE_REPARSE_FORBIDDEN' });
    assert.deepEqual(await readdir(trap), []);
    await broker.close();
    await rm(trap, { recursive: true, force: true });
  });
});
```

Keep symbolic-link cases separate. A missing privilege is a reported skip during ordinary development, but an acceptance run must force failure rather than silently pass:

```js
async function requireSymlink(t, target, path, type) {
  try { await symlink(target, path, type); }
  catch (error) {
    if (error?.code !== 'EPERM') throw error;
    if (process.env.MOEMOA_REQUIRE_WINDOWS_SYMLINK_TEST === '1') {
      assert.fail('Windows symlink acceptance requires Developer Mode or symbolic-link privilege');
    }
    t.skip('Windows symbolic-link privilege unavailable; acceptance run still required');
  }
}
```

Add an eight-process concurrent same-digest test and a natural rename-collision cleanup test:

```js
windowsTest('eight brokers converge on one immutable checksum file', async () => {
  await withSyntheticWorkspace(async ({ repoRoot, workspaceRoot }) => {
    const stores = await Promise.all(Array.from({ length: 8 }, async () => {
      const broker = createWindowsCoverStoreBroker();
      try {
        return await broker.store({ requestId: randomUUID(), repoRoot, workspaceRoot, animeId,
          checksum: digest(pngBytes), extension: 'png', bytes: pngBytes });
      } finally { await broker.close(); }
    }));
    assert.equal(stores.filter((row) => row.status === 'CREATED').length, 1);
    assert.equal(stores.filter((row) => row.status === 'EXISTING').length, 7);
    assert.equal(new Set(stores.map((row) => row.localRef)).size, 1);
    const destination = join(workspaceRoot, ...stores[0].localRef.split('/'));
    assert.equal(digest(await readFile(destination)), digest(pngBytes));
    assert.deepEqual((await readdir(join(workspaceRoot, 'images', 'covers', animeId.replace(':', '-'))))
      .filter((name) => name.endsWith('.tmp')), []);
  });
});
```

Precreate and preserve: exact bytes, different short bytes, an 8 MiB+1 file, a directory, a file symlink, and a junction at the checksum destination. Exact bytes return `EXISTING`; every other object returns `COVER_STORE_COLLISION` or `COVER_STORAGE_REPARSE_FORBIDDEN` and remains unchanged. Hold the destination with incompatible write/delete access and require `COVER_STORAGE_SHARING_VIOLATION`.

For the deterministic lock test, do not add a production protocol command. The test starts a separate PowerShell reflection probe that loads the same C# file, invokes the non-public `PinnedDirectoryChain.Open(string)` method, writes `READY`, and waits for one stdin byte while retaining the returned `IDisposable`. Node must observe rename/delete failure while the handles are held, release the probe, then observe the same benign rename succeed. Construct the reflection script in the test and pass it with `-EncodedCommand`; the production broker protocol remains unchanged.

- [ ] **Step 7: Run the expanded focused test and confirm RED**

Run: `node --test tests/catalog-lab/windows-cover-storage.test.mjs`

Expected on Windows before native implementation: protocol/lifecycle tests pass, while valid storage/reparse/concurrency cases fail with `COVER_STORAGE_IO_FAILED`, a missing `PinnedDirectoryChain`, or successful unsafe traversal. No test may create a file in an external trap.

- [ ] **Step 8: Implement the documented no-follow handle algorithm**

Add P/Invokes with `SetLastError=true` for `CreateFileW`, `CreateDirectoryW`, `GetFileInformationByHandleEx`, `GetFileInformationByHandle`, `GetFinalPathNameByHandleW`, `GetDriveTypeW`, `GetVolumeInformationW`, `WriteFile`, `ReadFile`, `FlushFileBuffers`, and `SetFileInformationByHandle`. Use `SafeFileHandle`; do not use undocumented NT APIs.

Implement these exact internal methods:

```csharp
internal sealed class PinnedDirectoryChain : IDisposable {
    internal static PinnedDirectoryChain Open(string absolutePath);
    internal SafeFileHandle LeafHandle { get; }
    public void Dispose();
}

internal static class WorkspaceVerifier {
    internal static VerifiedWorkspace OpenAndVerify(string repoRoot, string workspaceRoot);
}

internal static class ImmutablePublisher {
    internal static StoreResult Store(
        VerifiedWorkspace workspace, string animeId, string checksum,
        string extension, byte[] body);
}
```

The implementation sequence is fixed:

1. Accept canonical drive-letter paths only; reject UNC/device/ADS/root/dot/trailing-dot/trailing-space ambiguity without access.
2. Require `GetDriveTypeW(...) == DRIVE_FIXED` and filesystem name exactly `NTFS`.
3. From the drive root, open each repository and workspace prefix with directory read-attributes/traverse/synchronize access, `OPEN_EXISTING`, `FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT`, non-inheritable handles, and `FILE_SHARE_READ` only. Omit both `FILE_SHARE_WRITE` and `FILE_SHARE_DELETE`; Windows acceptance must prove that intended child creation still succeeds through the pinned chain while a second write/reparse-capable directory open fails with a sharing violation.
4. Query `FileAttributeTagInfo` from each handle, require `FILE_ATTRIBUTE_DIRECTORY`, reject any `FILE_ATTRIBUTE_REPARSE_POINT`, and retain all handles.
5. Compare `GetFinalPathNameByHandleW(FILE_NAME_NORMALIZED | VOLUME_NAME_GUID)` paths case-insensitively at component boundaries; reject equality and containment in either direction.
6. Open and retain `TEST_ONLY.json` no-follow with read-only sharing; require a regular non-reparse file of at most 256 bytes and exact JSON values `kind='MOEMOA_CATALOG_LAB'`, `schemaVersion=1`.
7. For fixed children `images`, `covers`, and derived `anime-<uuid>`, call `CreateDirectoryW`, accept only success/already-exists, immediately open no-follow, validate, and retain the handle before touching its contents.
8. If the final checksum path exists, open no-follow with no write/delete sharing, require bounded regular non-reparse content, exact length, and recomputed digest; return `EXISTING` only on exact match.
9. Create `.<digest>.<requestUuid>.tmp` with `CREATE_NEW`, read/write/delete access, `FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_WRITE_THROUGH`, and no write/delete sharing. Write completely, verify digest/end-of-file, and `FlushFileBuffers`.
10. Allocate architecture-correct `FILE_RENAME_INFO` memory with `ReplaceIfExists=FALSE`. First validate the documented pinned-`RootDirectory`/relative-leaf form with a temporary x64 Windows-SDK oracle outside the repository. If both native and C# controls reproduce Win32 87, derive a normalized `VOLUME_NAME_GUID` parent from the retained final-directory handle, append only `<digest>.<extension>`, and call `SetFileInformationByHandle(FileRenameInfo)` with a null root and that internally derived absolute target. Do not retain the probe binary and do not accept the request's path spelling.
11. On an existing/access rename result, mark the temp handle with `FileDispositionInfo(DeleteFile=TRUE)`, close it, and verify the destination. Return `EXISTING` only for exact content; otherwise collision/error.
12. On success, retain the renamed handle, call `FlushFileBuffers` again, reopen the destination no-follow while all pins remain held, compare NTFS volume serial/file index to the renamed handle, verify exact size and SHA-256, return `CREATED`, then close file, sentinel, and directory handles in reverse order.

Handled failures disposition-delete the current temp. Abrupt process death may leave a hidden temp but may never expose partial bytes under the checksum filename. Do not scan/delete unrelated stale files.

- [ ] **Step 9: Run mandatory Windows acceptance and interop checks**

Run ordinary local-NTFS coverage:

`node --test tests/catalog-lab/windows-cover-storage.test.mjs`

Expected on Windows: PASS for protocol, missing helper, exact store/dedupe, junctions, lock pinning, collisions, cleanup, and eight-process concurrency. A symlink case may report SKIP only if the local token lacks capability.

Run the required symlink-capable acceptance from a Developer Mode or appropriately privileged terminal:

```powershell
$env:MOEMOA_REQUIRE_WINDOWS_SYMLINK_TEST = '1'
node --test tests/catalog-lab/windows-cover-storage.test.mjs
$exitCode = $LASTEXITCODE
Remove-Item Env:MOEMOA_REQUIRE_WINDOWS_SYMLINK_TEST
exit $exitCode
```

Expected: PASS with directory and file symlink cases executed, no symlink skip, and all external traps empty.

Run x64/interop confirmation:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -Command '[Environment]::Is64BitProcess; $PSVersionTable.PSVersion.ToString()'
```

Expected: first line `True`; second line starts with `5.1`.

- [ ] **Step 10: Run the catalog regression while Windows integration remains fail-closed**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: all catalog tests pass. In particular, `tests/catalog-lab/cover-validation.test.mjs` still passes its current Windows assertion that production and fixture storage throw `COVER_STORAGE_PLATFORM_UNSAFE` before workspace access. The new isolated broker tests pass independently and do not change CoverRecord behavior.

- [ ] **Step 11: Commit Task 1 and stop for independent review**

```powershell
git add tools/catalog-lab/windows/cover-store-native.cs tools/catalog-lab/windows/cover-store-broker.ps1 tools/catalog-lab/lib/windows-cover-store.mjs tests/catalog-lab/windows-cover-storage.test.mjs
git commit -m "feat(catalog): spike safe Windows cover storage broker"
```

Expected: one reviewable commit containing no binary/project/dependency change. Stop here. Task 2 is prohibited until an independent reviewer accepts the protocol bounds, P/Invoke layouts, handle sharing, reparse rejection, rename/error mapping, all mandatory Windows results, and the explicit durability non-claim.

---

### Task 2: Authenticate workspace context and integrate the reviewed broker behind existing cover trust

Task 2 wires only the accepted Task 1 backend into the existing persistence seam. It must not weaken production acquisition/decode brands, expose raw workspace paths to CoverRecords, alter POSIX behavior, or catch a Windows broker failure and use the current string-path implementation.

**Files:**
- Modify: `tools/catalog-lab/lib/workspace.mjs` — issue and validate an opaque, WeakMap-branded mutation context containing the already authenticated canonical workspace/repository roots.
- Modify: `tools/catalog-lab/lib/windows-cover-store.mjs` — add the authenticated high-level Windows storage API and a lazy broker lifecycle; retain Task 1 low-level API for isolated tests.
- Modify: `tools/catalog-lab/pipeline/covers.mjs` — choose the Windows backend only after existing production CoverRecord/decode checks; retain byte-for-byte POSIX storage semantics.
- Modify: `tests/catalog-lab/workspace-targets.test.mjs` — forged/stale context rejection and sentinel/root revalidation.
- Modify: `tests/catalog-lab/cover-validation.test.mjs` — Windows integrated synthetic harness behavior, untrusted-record rejection before workspace/broker, and POSIX regression.
- Modify: `tests/catalog-lab/windows-cover-storage.test.mjs` — authenticated-context integration, broker-unavailable fail-closed behavior, and broker shutdown coverage.

**Interfaces:**
- Produces from `tools/catalog-lab/lib/workspace.mjs`:

```js
export async function createCatalogWorkspaceMutationContext(workspace) {
  // returns an opaque frozen object branded in a module-private WeakMap
}

export function readCatalogWorkspaceMutationContext(context) {
  // returns Object.freeze({ workspaceRoot, repoRoot }) only for a branded context
  // throws CATALOG_WORKSPACE_UNTRUSTED for every forged value
}
```

- `createCatalogWorkspaceMutationContext()` reuses the existing authenticated `WORKSPACE_HANDLES` entry and immediately reruns root, repository exclusion, and exact sentinel checks before issuing a context. It exposes no `resolve()` callback and no arbitrary destination.
- Produces from `tools/catalog-lab/lib/windows-cover-store.mjs`:

```js
export async function storeWindowsCoverBytes({
  context, bytes, digest, extension, animeId,
}) {
  // -> Object.freeze({ localRef, created })
}

export async function closeWindowsCoverStoreBroker() {
  // graceful close for tests/runner shutdown; idempotent
}
```

- `storeWindowsCoverBytes()` calls `readCatalogWorkspaceMutationContext(context)`, derives a fresh request UUID, and uses the reviewed low-level broker. It maps `CREATED` to `created:true` and `EXISTING` to `created:false`. A forged context fails before broker startup.
- `covers.mjs` retains these public interfaces unchanged: `storeValidatedCover({record, workspace, animeId})`, `createCoverStorageTestHarness()`, and `selectCanonicalCover(candidates)`.
- `createCoverStorageTestHarness().observeProductionPlatformGate()` now returns `{allowed:true, platform:'win32', backend:'WINDOWS_POWERSHELL_PINVOKE'}` only when the reviewed integration is present; this observation does not start the broker or mint a CoverRecord. Actual broker unavailability still fails storage.
- On non-Windows, observation returns `{allowed:true, platform:process.platform, backend:'POSIX_HARD_LINK'}` and the existing directory/temp/hard-link/checksum algorithm remains semantically unchanged.

- [ ] **Step 1: Write failing authenticated-context tests**

Extend workspace tests with an opaque capability and forged-value rejection:

```js
test('workspace mutation context is opaque and cannot be forged', async () => {
  await withWorkspace(async (workspace) => {
    const context = await createCatalogWorkspaceMutationContext(workspace);
    assert.deepEqual(Object.keys(context), []);
    const paths = readCatalogWorkspaceMutationContext(context);
    assert.equal(paths.workspaceRoot, workspace.root);
    assert.equal(paths.repoRoot, await realpath(repoRoot));
    assert.throws(() => readCatalogWorkspaceMutationContext(Object.freeze({
      workspaceRoot: workspace.root, repoRoot,
    })), { code: 'CATALOG_WORKSPACE_UNTRUSTED' });
  });
});
```

Add a test that replaces/removes the sentinel after `openCatalogWorkspace()` but before context creation; context creation must fail `CATALOG_WORKSPACE_SENTINEL_INVALID` and issue no context.

- [ ] **Step 2: Write failing Windows integration and trust-order tests**

Replace the current Windows fixture fail-closed expectation only in the new test content; do not change production code yet:

```js
test('Windows integrated fixture storage remains observation-only', { skip: process.platform !== 'win32' }, async () => {
  await withWorkspace(async (workspace) => {
    const storage = createCoverStorageTestHarness();
    assert.deepEqual(storage.observeProductionPlatformGate(), {
      allowed: true, platform: 'win32', backend: 'WINDOWS_POWERSHELL_PINVOKE',
    });
    const first = await storage.storeFixture({ bytes: pngBytes, declaredMime: 'image/png', workspace, animeId });
    const second = await storage.storeFixture({ bytes: pngBytes, declaredMime: 'image/png', workspace, animeId });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.localRef, first.localRef);
    assert.equal(selectCanonicalCover([first, second]), null);
    await closeWindowsCoverStoreBroker();
  });
});

test('untrusted downloaded records fail before workspace access on every platform', async () => {
  const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor() });
  let workspaceAccesses = 0;
  const workspace = new Proxy({}, { get() { workspaceAccesses += 1; throw new Error('unexpected workspace access'); } });
  await assert.rejects(storeValidatedCover({ record: sniffed, workspace, animeId }),
    { code: 'COVER_RECORD_UNTRUSTED' });
  assert.equal(workspaceAccesses, 0);
});
```

Add a direct `storeWindowsCoverBytes()` test with `context:Object.freeze({})`; expect `CATALOG_WORKSPACE_UNTRUSTED` and no helper process/output directory. Retain the Task 1 missing-PowerShell test and assert there is no call to the POSIX persistence path after `COVER_STORAGE_HELPER_UNAVAILABLE`.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

`node --test tests/catalog-lab/workspace-targets.test.mjs tests/catalog-lab/cover-validation.test.mjs tests/catalog-lab/windows-cover-storage.test.mjs`

Expected on Windows: FAIL because workspace context exports and `storeWindowsCoverBytes()` do not exist, and the current platform gate still throws `COVER_STORAGE_PLATFORM_UNSAFE`. Existing untrusted-record tests remain PASS.

- [ ] **Step 4: Implement the opaque workspace mutation context**

Add a module-private WeakMap beside `WORKSPACE_HANDLES`:

```js
const WORKSPACE_MUTATION_CONTEXTS = new WeakMap();

export async function createCatalogWorkspaceMutationContext(workspace) {
  const trusted = WORKSPACE_HANDLES.get(workspace);
  if (!trusted) {
    const error = new Error('Catalog workspace handle is not authenticated');
    error.code = 'CATALOG_WORKSPACE_UNTRUSTED';
    throw error;
  }
  await assertCatalogWorkspaceMutation(workspace, []);
  const context = Object.freeze({});
  WORKSPACE_MUTATION_CONTEXTS.set(context, Object.freeze({
    workspaceRoot: trusted.root,
    repoRoot: trusted.canonicalRepo,
  }));
  return context;
}

export function readCatalogWorkspaceMutationContext(context) {
  const trusted = WORKSPACE_MUTATION_CONTEXTS.get(context);
  if (!trusted) {
    const error = new Error('Catalog workspace mutation context is not authenticated');
    error.code = 'CATALOG_WORKSPACE_UNTRUSTED';
    throw error;
  }
  return trusted;
}
```

Do not serialize the context, attach paths as public properties, or accept a raw object with matching property names.

- [ ] **Step 5: Implement authenticated broker storage and lifecycle**

In `windows-cover-store.mjs`, keep a module-private lazy broker promise. `storeWindowsCoverBytes()` must read the branded context before creating the broker, preserve all Task 1 limits, and never catch a helper/native failure to invoke another backend:

```js
let sharedBroker;

export async function storeWindowsCoverBytes({ context, bytes, digest, extension, animeId } = {}) {
  const { workspaceRoot, repoRoot } = readCatalogWorkspaceMutationContext(context);
  const broker = sharedBroker ??= createWindowsCoverStoreBroker();
  const result = await broker.store({
    requestId: randomUUID(), repoRoot, workspaceRoot, animeId,
    checksum: digest, extension, bytes,
  });
  return Object.freeze({ localRef: result.localRef, created: result.status === 'CREATED' });
}

export async function closeWindowsCoverStoreBroker() {
  const broker = sharedBroker;
  sharedBroker = undefined;
  if (broker) await broker.close();
}
```

If the shared broker exits or violates protocol, clear it only after the pending request fails. A later explicit store may start a fresh broker, but the failed mutation is not automatically replayed.

- [ ] **Step 6: Integrate behind the existing CoverRecord/decode gate and preserve POSIX behavior**

Rename the current private implementation to `persistCoverBytesPosix()` without changing its statements. Add a small dispatcher:

```js
async function persistCoverBytes(input) {
  if (typeof input.animeId !== 'string' || !ANIME_ID.test(input.animeId)) {
    throw typedError('COVER_ANIME_ID_INVALID', 'Cover anime ID is not safe for external storage');
  }
  if (process.platform !== 'win32') return persistCoverBytesPosix(input);
  const context = await createCatalogWorkspaceMutationContext(input.workspace);
  return storeWindowsCoverBytes({
    context,
    bytes: input.image,
    digest: input.digest,
    extension: input.extension,
    animeId: input.animeId,
  });
}
```

Delete only the unconditional Windows throw from `assertProductionStoragePlatformSafe()`/its call sites. Keep the ordering in `storeValidatedCover()`:

```text
private CoverRecord brand
→ private production-acquisition brand
→ validationStatus === DECODED
→ private bytes present
→ authenticated workspace context
→ Windows broker or unchanged POSIX backend
→ create stored branded record
```

The fixture harness uses the same dispatcher after its existing `asBytes()` and `inspectImageBytes()` checks, returns only `{checksum, byteSize, localRef, created}`, and never touches either CoverRecord WeakSet. `observeProductionPlatformGate()` reports the configured backend but does not promise that PowerShell policy permits startup.

- [ ] **Step 7: Run focused integration tests and confirm GREEN**

Run:

`node --test tests/catalog-lab/workspace-targets.test.mjs tests/catalog-lab/cover-validation.test.mjs tests/catalog-lab/windows-cover-storage.test.mjs`

Expected on Windows: PASS for opaque context, rejected forged/stale context, exact integrated fixture store/dedupe, no record minting, untrusted record before workspace access, Task 1 junction/symlink/concurrency cases, broker close, and helper-unavailable fail-closed behavior.

Expected on non-Windows: existing POSIX cover tests pass unchanged; Windows cases are skipped and do not affect POSIX results.

- [ ] **Step 8: Run the full catalog and application regressions**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: all catalog tests pass, including the complete cover transport/decode/storage suite and all new Windows tests.

Run: `npm run test:unit`

Expected: all application unit tests pass; no Memory Card, resolver, IndexedDB, or image lifecycle behavior changes.

Run: `npm run build`

Expected: production Web build passes without importing the helper, workspace path, or local cover bytes into `dist`.

- [ ] **Step 9: Run explicit leakage and tracked-artifact gates**

Run from PowerShell:

```powershell
$forbiddenTracked = git ls-files | Select-String -Pattern '(^|/)(bin|obj)(/|$)|(?i)\.(dll|exe)$|(^|/)TEST_ONLY\.json$|(^|/)images/covers/'
if ($forbiddenTracked) { $forbiddenTracked; exit 1 }
$scanRoots = @('dist', 'android/app/src/main/assets/public') | Where-Object { Test-Path $_ }
if ($scanRoots.Count -gt 0) {
  $markers = rg -l --fixed-strings '"kind":"MOEMOA_CATALOG_LAB"' $scanRoots
  if ($LASTEXITCODE -eq 0) { $markers; exit 1 }
  $markers = rg -l --fixed-strings '"rawPayloadRef":' $scanRoots
  if ($LASTEXITCODE -eq 0) { $markers; exit 1 }
}
git diff --check
```

Expected: no tracked binary/project/output/sentinel/cover path, no serialized workspace payload marker in build roots, and `git diff --check` exits 0. Tracked `.cs`, `.ps1`, `.mjs`, tests, and this plan are expected source files and are not binary leaks.

- [ ] **Step 10: Re-run the mandatory symlink-capable Windows acceptance after integration**

```powershell
$env:MOEMOA_REQUIRE_WINDOWS_SYMLINK_TEST = '1'
node --test tests/catalog-lab/windows-cover-storage.test.mjs tests/catalog-lab/cover-validation.test.mjs
$exitCode = $LASTEXITCODE
Remove-Item Env:MOEMOA_REQUIRE_WINDOWS_SYMLINK_TEST
exit $exitCode
```

Expected: PASS with no skipped symlink case, no external trap write, and integrated harness results remaining observation-only.

- [ ] **Step 11: Commit Task 2 and stop for final independent review**

```powershell
git add tools/catalog-lab/lib/workspace.mjs tools/catalog-lab/lib/windows-cover-store.mjs tools/catalog-lab/pipeline/covers.mjs tests/catalog-lab/workspace-targets.test.mjs tests/catalog-lab/cover-validation.test.mjs tests/catalog-lab/windows-cover-storage.test.mjs
git commit -m "feat(catalog): integrate safe Windows cover persistence"
```

Expected: one integration commit on top of the accepted Task 1 commit, with no dependency, project, binary, payload, original-plan, or approved-design modification.

Stop for independent review. If any test, leak gate, symlink-capable run, API/error review, or durability wording review fails, revert Task 2 or leave it unapproved; the accepted fallback remains the Task 1-isolated/current Task 7 Windows fail-closed state. Task 8 remains blocked until both Task 1 and Task 2 have explicit passing review verdicts.
