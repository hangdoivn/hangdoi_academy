# Academy MySQL — Backup & Recovery Runbook

## Scope

This runbook applies only to the Hang Đôi Academy candidate data layer in Railway project `hangdoi-academy-candidate-api`.

Production data path:

`candidate-api-v2 -> MySQL 8.4 service candidate-api -> volume mysql-data:/var/lib/mysql`

The Academy data layer is isolated from Hang Đôi Production.

## Current backup policy

Railway native volume backups are enabled on `mysql-data` for all three schedules:

- Daily — every 24 hours, retained for 6 days
- Weekly — every 7 days, retained for 27 days
- Monthly — every 30 days, retained for 89 days

Railway volume backups are incremental / copy-on-write.

The volume is currently 500 MB. Do not wipe or replace the volume as part of routine maintenance because wiping a volume also deletes its backups.

## Recovery objectives

Operational objectives for the current Academy workload:

- RPO objective: <= 24 hours, bounded by the daily Railway volume backup schedule
- RTO objective: <= 30 minutes for a straightforward volume restore + API verification

These are internal operating targets, not provider guarantees.

## Restore gate

Do not restore a snapshot merely because an API request fails.

Before restore:

1. Confirm the incident is data/storage related.
2. Check `candidate-api-v2` deployment and runtime logs.
3. Check MySQL service health and resource usage.
4. Confirm the required recovery point from the Railway Backups tab.
5. Record the incident timestamp and selected backup timestamp.
6. Do not delete the current volume or the retained Postgres archive.

## Railway volume restore procedure

Railway volume restores are performed from the MySQL service Backups tab.

1. Select service `candidate-api` (MySQL 8.4).
2. Open **Backups**.
3. Select the required dated backup.
4. Click **Restore**.
5. Railway stages a replacement volume mounted at `/var/lib/mysql`.
6. Review staged changes before deployment.
7. Confirm the old volume remains retained and is not being deleted.
8. Deploy the staged restore.
9. Wait for MySQL to become healthy.
10. Verify `candidate-api-v2` returns HTTP 200 from `GET /health`.
11. Verify an application-level read path.
12. Verify one reversible write/read smoke transaction or the runtime smoke log.
13. Confirm Academy landing/apply pages remain reachable.
14. Record the restored backup timestamp and recovery completion time.

A restored Railway volume keeps backups up to and including the restored point. Newer backups remain attached to the previous retained volume.

## Roll-forward / rollback after restore

If the restored snapshot is correct:

- keep the previous volume temporarily until the incident is closed;
- keep the Postgres archive untouched;
- resume normal MySQL runtime;
- document any data that must be replayed between the backup timestamp and incident time.

If the restored snapshot is not correct:

- do not destroy either volume;
- stop further writes if data divergence is possible;
- inspect the previously mounted volume and choose the correct recovery point.

## Legacy Postgres archive

The `Postgres` service is not referenced by any live Candidate API runtime.

It is retained only as a short-term cutover archive / rollback source.

Do not re-enable Postgres as a runtime dependency unless a confirmed MySQL-specific incident requires the documented rollback path.

## Continuous health monitoring

Railway's HTTP healthcheck is deploy-time only; it is not a continuous uptime monitor.

Current continuous watch should check:

- `https://candidate-api-v2-production.up.railway.app/health`
- `https://academy.hangdoiproduction.com/media-career-program/`

Alert only on a meaningful availability failure. The API health endpoint already performs a MySQL `SELECT 1`, so an API health failure covers loss of the database dependency as well as API availability.

Recommended incident thresholds:

- HTTP health endpoint non-200: immediate investigation
- repeated service crash/restart: investigate
- disk usage > 70%: plan volume growth
- disk usage > 85%: urgent remediation
- memory sustained near service limit: investigate before scaling

## Postgres retirement gate

Do not delete the retained Postgres service until all conditions are true:

1. MySQL-only production runtime has remained stable for at least 7 calendar days.
2. At least one successful daily Railway volume backup exists.
3. A restore procedure has been reviewed against a real available backup.
4. Candidate API health and Academy page monitoring are active.
5. No runtime service contains `DATABASE_URL`.
6. MySQL row counts / core business data remain consistent.
7. No unresolved migration or data-integrity incident exists.
8. The stabilization window is explicitly closed.

Postgres deletion is a separate destructive action and must not be bundled into unrelated deployment work.
