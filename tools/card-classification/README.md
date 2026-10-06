# Card classification migration candidate

`supabase/migrations/20261005090000_memory_card_classification.sql` adds private per-Memory character references and custom tags. It does not add them to public snapshots or change public flags.

Local validation on Windows with the existing Ubuntu/PostgreSQL 16 installation:

```powershell
wsl -d Ubuntu -u postgres -- bash -lc 'PG_BIN=/usr/lib/postgresql/16/bin bash /mnt/e/web/anime/tools/card-classification/run-local-postgres.sh'
```

The runner creates a disposable cluster with a private Unix socket, no TCP listener and no remote URL. It applies the existing migrations plus this candidate; platform-only pg_cron retention is excluded. Auth/Storage schemas use the existing local bootstrap stubs. This proves the local SQL contract, not hosted Supabase/PostgREST/Auth behavior. Artifacts stay under the printed `/tmp/moemoa-card-tags.*` path and the server stops on exit.

`contract.sql` checks private persistence, acknowledgements, replay, old-client preservation, invalid input rollback, version conflict/resolution, guest promotion, owner and anonymous boundaries, wrapper permissions and deletion.

Rollout is separate from this local task. Apply the approved migration to the approved test environment first, then enable `PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1=1` there and verify tagged save/pull/conflict/promotion with actual accounts. Do not enable it against an old schema. The default-off client saves tags on the current device and preserves them when an old server omits the field. After rollout, explicitly saving a card queues its locally pending tags.

Rollback: turn the new flag off and restore the previous UI/read path. Retain the additive column and its data; do not drop it or reset user metadata. Production application and Git deployment require the existing D06 candidate approval.
