# Academy MySQL — Backup & Recovery Runbook

## Scope

This runbook applies only to the Hang Đôi Academy candidate data layer in Railway project `hangdoi-academy-candidate-api`.

Production data path:

`candidate-api-v2 -> MySQL 8.4 service candidate-api -> mysql-data:/var/lib/mysql`

Backup data path:

`candidate-api-v2 -> private Railway Storage Bucket academy-mysql-backups`

The Academy data layer is isolated from Hang Đôi Production.

## Railway plan constraint

The current Railway workspace is on the Hobby plan.

For this workspace Railway reports:

- volume size limit: 500 MB
- native volume backup limit: `maxBackupsCount = 0`

Therefore **Railway native volume snapshots are not a valid backup mechanism on the current plan**. Do not treat a staged Daily/Weekly/Monthly volume backup schedule as evidence that a snapshot exists.

## Active backup design

The application implements a logical MySQL backup to the private Railway Storage Bucket `academy-mysql-backups`.

Production-only runtime variables:

- `BACKUP_BUCKET`
- `BACKUP_REGION`
- `BACKUP_ENDPOINT`
- `BACKUP_ACCESS_KEY_ID`
- `BACKUP_SECRET_ACCESS_KEY`
- `BACKUP_UTC_HOUR=18`
- `BACKUP_UTC_MINUTE=15`

The credential values are Railway variable references from the bucket. Secrets must never be committed to Git.

Backup behavior:

- scheduler runs in `candidate-api-v2`
- normal target time: 18:15 UTC / 01:15 Asia/Ho_Chi_Minh
- after a process start, the scheduler checks whether a backup already exists for the current UTC date
- if no daily backup exists, it creates one after startup
- backup failures are logged and must not crash the Candidate API
- retention: 90 days
- bucket is private and encrypted at rest by the storage provider

## Backup consistency and format

Backup code:

- `api/backup-mysql.js`
- one-off command: `npm run backup:mysql`

Each backup:

1. Opens one MySQL connection.
2. Starts `REPEATABLE READ` with `START TRANSACTION WITH CONSISTENT SNAPSHOT`.
3. Enumerates all base tables in the active Academy database.
4. Captures each table's `SHOW CREATE TABLE` statement.
5. Captures all rows from the same consistent snapshot.
6. Rolls back the read-only snapshot transaction.
7. Serializes the snapshot as JSON.
8. Compresses it with gzip.
9. Calculates a SHA-256 checksum.
10. Uploads it to the private bucket.
11. Updates `mysql/latest.json` with the latest verified object metadata.
12. Prunes backup objects older than 90 days.

Object layout:

`mysql/daily/YYYY/MM/DD/hangdoi-academy-<timestamp>.json.gz`

Latest manifest:

`mysql/latest.json`

The log line for a successful backup starts with:

`[mysql-backup] uploaded`

## Recovery objectives

After the first successful production backup is verified:

- RPO objective: <= 24 hours
- RTO: must be measured by the first restore drill before a formal target is declared

These are internal operating objectives, not provider guarantees.

## Safe restore drill

Restore code:

`api/restore-mysql-backup.js`

Command:

`npm run restore:mysql:drill`

Required gate:

`RESTORE_CONFIRM=ACADEMY_RESTORE_DRILL`

Restore is deliberately restricted to database names matching:

`hangdoi_academy_restore_*`

This prevents the drill script from replacing the production database.

The drill:

1. Resolves `BACKUP_KEY` or reads `mysql/latest.json`.
2. Downloads the backup from the private bucket.
3. Verifies the object SHA-256 when metadata is available.
4. Creates a fresh shadow restore database.
5. Recreates tables from captured DDL.
6. Restores all rows with foreign-key checks temporarily disabled.
7. Re-enables foreign-key checks.
8. Verifies row counts for every restored table.
9. Emits `[mysql-restore] verified` only if all counts match.

## Production recovery gate

Do **not** overwrite the production database directly from a backup.

For a real data-loss incident:

1. Freeze or minimize writes if divergence is possible.
2. Identify the correct backup object.
3. Restore and verify it in a shadow database first.
4. Compare row counts and critical candidate records.
5. Record the backup timestamp and data-loss window.
6. Prepare a deliberate cutover from production DB to the verified restored database.
7. Keep the original MySQL database and retained Postgres archive until the incident is closed.

A production promotion/cutover must be treated as a separate incident action.

## Continuous health monitoring

Railway's configured HTTP healthcheck is deploy-time only; it is not continuous monitoring.

Current continuous watch checks:

- `https://candidate-api-v2-production.up.railway.app/health`
- `https://academy.hangdoiproduction.com/media-career-program/`

The API health route performs a MySQL `SELECT 1`, so it detects both API unavailability and loss of the live DB dependency.

The current Railway Hobby plan does not include native Observability threshold monitors.

Operational thresholds to review manually:

- MySQL disk > 70% of 500 MB: plan storage action
- MySQL disk > 85%: urgent remediation
- MySQL memory sustained > 80% of the 1 GB plan limit: investigate
- repeated crash/restart events: investigate

## Legacy Postgres archive

The `Postgres` service is not referenced by any live Candidate API runtime.

It remains only as a temporary cutover archive / emergency rollback source.

Do not re-enable Postgres as a runtime dependency unless a confirmed MySQL-specific incident requires the documented rollback path.

## Postgres retirement gate

Do not delete the retained Postgres service until all conditions are true:

1. MySQL-only production runtime has remained stable for at least 7 calendar days.
2. At least one production bucket backup has completed successfully.
3. A restore drill from a real bucket backup has emitted `[mysql-restore] verified`.
4. Candidate API health and Academy page monitoring are active.
5. No runtime service contains `DATABASE_URL`.
6. MySQL core business data remains consistent.
7. No unresolved migration, backup, or data-integrity incident exists.
8. The stabilization window is explicitly closed.

Postgres deletion is a separate destructive action and must not be bundled into unrelated deployment work.
