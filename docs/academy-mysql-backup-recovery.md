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

The repository workflow `.github/workflows/academy-ops-monitor.yml` runs every 15 minutes and can also be started manually.

It checks:

- `GET https://candidate-api-v2-production.up.railway.app/health`
  - API process is reachable
  - live MySQL dependency answers `SELECT 1`
- `GET https://candidate-api-v2-production.up.railway.app/health/intake`
  - the tables and columns required by the public intake, event tracking, notifications, cohort state, and legal-readiness read paths exist and are readable
- `POST https://candidate-api-v2-production.up.railway.app/health/intake/write`
  - opens a MySQL transaction
  - writes synthetic rows to applications, events, and notifications
  - verifies all three rows inside the transaction
  - rolls the transaction back
  - verifies from a separate connection that no synthetic row remains
  - never calls application or acknowledgement webhooks
- `GET https://candidate-api-v2-production.up.railway.app/health/submissions`
  - summarizes the last 24 hours of client submit successes, submit errors, accepted applications, and deduplicated retries
  - returns unhealthy only after at least 5 system-observable attempts, at least 3 system errors, and a system-error rate of at least 50%
  - offline and expected business-validation errors do not count as infrastructure/system errors
- `GET https://candidate-api-v2-production.up.railway.app/health/backup`
  - latest logical backup is available and no older than 30 hours
- `https://academy.hangdoiproduction.com/media-career-program/`
  - landing returns HTTP 200 and the expected Media Career marker
- `https://academy.hangdoiproduction.com/media-career-program/apply/`
  - apply page returns HTTP 200 and contains `interestForm`
- CORS preflight for `POST /v1/applications`
  - returns HTTP 200/204
  - explicitly permits `https://academy.hangdoiproduction.com`

Failure behavior:

1. The workflow records all failed checks in its Actions summary.
2. It creates one deduplicated GitHub incident labeled `academy-ops-monitor`, or appends to the existing open incident.
3. The workflow run fails so normal GitHub Actions failure notifications can surface the incident.
4. On a later healthy run, the workflow comments the recovery time and closes the incident automatically.

The monitor deliberately does **not** run immediately on every `api/**` push. A first implementation did so and produced a deploy-race false alarm while Railway was still replacing the old revision. Railway's deploy-time `/health` gate covers the deployment itself; the independent 15-minute monitor covers post-deploy availability without alerting during expected rollout propagation.

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


## Verified recovery evidence — 2026-09-25

The first production logical backup and restore drill have been verified.

Backup evidence:

- object: `mysql/daily/2026/09/25/hangdoi-academy-2026-09-25T04-59-23-459Z.json.gz`
- compressed size: 3,469 bytes
- tables captured: 10
- SHA-256: `a3cf2133732c5c2bdf0761542403147d7620d66bbab508f131d76b0c5a3bcf83`
- backup reason: startup
- runtime result: `[mysql-backup] uploaded`

Restore drill evidence:

- shadow database: `hangdoi_academy_restore_20260925`
- restore result: `[mysql-restore] verified`
- table count verified: 10
- verified row counts:
  - `media_career_admissions`: 0
  - `media_career_applications`: 0
  - `media_career_assessments`: 0
  - `media_career_campaigns`: 0
  - `media_career_cohorts`: 1
  - `media_career_events`: 43
  - `media_career_legal_readiness`: 1
  - `media_career_notifications`: 0
  - `media_career_selection_appointments`: 0
  - `media_career_stage_history`: 0
- shadow database cleanup result: `[mysql-restore] cleaned`
- runtime restore itself completed in under 1 second at the current small dataset size
- full disposable runner deployment completed in under 1 minute

The operational recovery target remains **RTO <= 30 minutes** to allow for incident diagnosis, backup selection, restore verification, and deliberate cutover. The technical restore time above is not a guarantee for future larger datasets.

The restore drill initially exposed an ISO timestamp conversion defect. It was corrected before the successful drill; the successful evidence above is from the corrected restore path.


## Verified monitoring evidence — 2026-09-25

Production monitor verification after deploying the intake-readiness route:

- `/health`: HTTP 200
- `/health/intake`: HTTP 200
- `/health/intake/write`: HTTP 200; transactional application/event/notification write verified and rolled back
- `/health/submissions`: HTTP 200; 24-hour submission-quality threshold active
- `/health/backup`: HTTP 200
- `OPTIONS /v1/applications`: HTTP 204 with the Academy origin allowed
- Railway deployment serving the verified checks: `3552ad54-beae-45d5-b64f-fcb6d43680c8`
- source revision: `6515c9ff9f26f70245fd5ed7a1766514c344aa07`

The first monitor run opened GitHub incident #33 because it ran before Railway had finished publishing the new `/health/intake` route. After the deploy reached `SUCCESS`, the next monitor run passed all checks, posted the recovery timestamp, and automatically closed incident #33. The push-trigger race was then removed from the monitor design.


### Verified write-path and submission-quality evidence — 2026-09-25

Transactional write probe:

- Railway deployment: `c7943bed-bc4d-4e6e-87f3-c4d72df690d2`
- source revision: `3c15df179db9d5f5bea79e949f83c7a039838fdd`
- monitor request: `POST /health/intake/write`
- result: HTTP 200
- observed Railway request duration: 107 ms on the first production verification
- a later production verification after the MySQL JSON decode fix returned HTTP 200 in 64 ms
- the endpoint returns success only after the transaction has been rolled back and a separate connection confirms that the synthetic application, event, and notification rows no longer exist

Submission observability:

- `form_submit_error` and `application_retry_received` were added to the accepted event telemetry set; before this correction those client/server events were silently discarded
- `/health/submissions` reports a rolling 24-hour quality window
- GitHub Actions monitor run `36116742060` completed successfully after the submission-quality check was enabled
- Railway deployment serving the quality endpoint: `d0efc198-e09f-46cf-8317-426bbdd1b97d`
- source revision: `c9a6d4a13275edf66171f2796d1b6d0a5b2d30c9`

MySQL JSON decode hardening:

- `mysql2` JSON fields are explicitly read with UTF-8 encoding
- the previous `JSON column ... interpreted as BINARY` runtime warning no longer appeared in the verification window after deployment `5ba9623a-78ac-4232-b6fa-4ea582b1990f`
