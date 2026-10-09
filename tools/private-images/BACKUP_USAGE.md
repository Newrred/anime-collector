# Private image backup tools

These are operator tools, not an enabled backup service. They do not connect to
Supabase, choose a destination, schedule jobs, retain keys, or restart serving.
Use the existing release-v2 W17/D05 record for status and approvals.

## Local encryption and quarantine restore

Use Node 24 and a directory with operator-only OS permissions (including Windows
ACLs). Keep raw DB dumps, journals and restored files outside Git and ordinary
CI artifacts. Store a random 32-byte encryption key separately in an approved
secret store. Supply its 64-character hexadecimal representation through the
`MOEMOA_BACKUP_KEY` process environment, never a command-line argument or log.
The tool does not generate or persist a production key for you.

Create a private, ignored JSON config:

```json
{
  "context": { "project": "nmgkhknponvzcwliajyk", "release": "approved-data-release-id" },
  "output": "E:/approved-backup-location/new-snapshot",
  "files": [
    { "name": "database.dump", "path": "E:/protected-staging/database.dump" },
    { "name": "latest-journal.json", "path": "E:/protected-staging/latest-journal.json" },
    { "name": "objects/representation-id/main.webp", "path": "E:/protected-staging/main.webp" },
    { "name": "objects/representation-id/thumb.webp", "path": "E:/protected-staging/thumb.webp" }
  ]
}
```

The example paths are placeholders, not an approved destination. Explicitly list
all required objects; a successful encryption result does not prove completeness.
Each file is streamed with its own random AES-256-GCM nonce and authenticated
project/release/object binding. Filenames and hashes are in an encrypted manifest.
Keys, private content, paths and object IDs are not printed by the CLI.

```powershell
node tools/private-images/backup-cli.mjs create .cache/backup-config.json
```

Restore config uses the same `context`, `source` pointing to the snapshot directory,
and `output` pointing to a **new quarantine directory**. Run:

```powershell
node tools/private-images/backup-cli.mjs restore .cache/restore-config.json
```

Only count/byte aggregates are printed. Final content is under `output/payload`.
Existing targets are refused. Wrong keys, wrong context, missing/corrupt bodies
or manifest tampering fail closed; failed staging is cleaned without deleting
inputs. Quarantine contains decrypted private data: restrict access and apply
the approved retention procedure. A crash/power loss can leave a `.partial-*`
directory; inspect its exact path before any cleanup. Do not infer durability
from a successful file copy alone; the approved remote destination needs its own
verification and key-recovery rehearsal.

## Externally retrieved ZIP verification (WSL)

`tools/operations/verify-external-backup.py` accepts an already downloaded ZIP,
the separately stored key **file path**, expected project/release and the SHA-256
recorded before upload. Use a new output directory under protected local staging:

```text
python3 -B tools/operations/verify-external-backup.py --archive <downloaded.zip> --key-file <separate.key> --output <new-quarantine> --project <project-ref> --release <release-id> --sha256 <original-archive-sha256>
```

Run with WSL paths and the existing Python `cryptography` package. The tool makes
no network or database calls. It authenticates the manifest and every file,
validates paths, lengths and hashes, and refuses an existing output. It never
executes or restores export README/context helper files. Failures leave a
`RESTORE_INCOMPLETE` marker; successful output has `VERIFIED_BYTES_ONLY.json`.
Both remain private quarantine, never a serving directory. This verifier avoids
the separate Windows Node final-rename path; it does not fix that path's EPERM.

Byte verification does **not** prove database import, completeness, deletion
reconciliation, or independent key availability. Keep the key off the backup
Drive and also outside the source PC, for example on a separately secured
external drive or in a password manager that supports protected file storage.
Do not print or paste key contents into chat, Git or ordinary logs.

## Latest deletion reconciliation is mandatory

`capture-recovery-journal.sql` reads one repeatable-read snapshot containing live
account IDs, card deletion state, current asset versions/state, card fences,
cancel-before-reserve records and complete private media manifests. Redirect its
output from the authorized operator connection to protected staging, then encrypt
it. Never send this SQL output to ordinary logs. No DB writes are performed.

This is **a snapshot, not a durable deletion event feed**. It cannot recover a
deletion that happened after its capture, or prove that a collection was complete
after an outage. Do not promise zero resurrection or reopen serving without a
verified complete latest record and current account/source state. Known-operation
cancellation changes media state without creating a `cancelled` row; backing up
that table alone is insufficient.

On recovery, keep private and Public flags off. Restore DB and encrypted bodies
into isolation, reconcile latest deletions/cancellations/account existence and
source versions, then restore only eligible READY representations with exact
manifest hashes/lengths. Do not auto-activate stale DB settings. Do not release
reserved bytes until physical reconciliation is proven. Public rights, sanctions,
withdrawals, catalog/canonical and DB restore have their existing additional
release-v2 requirements; this private tool does not replace them.

## Reproducible synthetic checks

```powershell
node --test tests/unit/encryptedBackup.test.mjs
node tools/private-images/recovery-rehearsal.mjs
```

The second command uses disposable local WSL PostgreSQL and generated WebP files.
It also encrypts/restores a real local DB dump and latest journal, checks byte
identity and decodes restored images. Its generated key is memory-only, so its
encrypted output is deliberately not a reusable operational backup.
