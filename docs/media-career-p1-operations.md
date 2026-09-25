# Media Career Program — P1 Operations

## Scope

This document describes the production setup for Hang Đôi Media Career Program P1.

The Academy implementation is isolated from the main Hang Đôi Production website.

**Do not modify:**
- `hangdoistudio.vn` root
- `www.hangdoistudio.vn`
- Production hosting/services
- root DNS / nameservers / MX records

## Public routes

- `/media-career-program/` — landing page
- `/media-career-program/apply/` — application form
- `/media-career-program/thank-you/` — submission confirmation

Canonical public domain:

`https://academy.hangdoiproduction.com`

## Internal route

- `/media-career-program/admin/` — candidate CRM

The admin page contains no embedded secret. It requires the Candidate API `ADMIN_TOKEN`, stored only as a Railway environment variable and browser sessionStorage after manual entry.

## Backend

Railway project:

`hangdoi-academy-candidate-api`

Production services:

- `candidate-api` — **Academy MySQL 8.4 database service** (legacy service name retained internally)
  - database: `hangdoi_academy`
  - persistent Railway volume: `mysql-data` mounted at `/var/lib/mysql`
- `candidate-api-v2` — production Candidate API, now running on MySQL
- `Postgres` — retained temporarily as rollback/source archive after the MySQL cutover

The API root directory is:

`/api`

Healthcheck:

`GET /health`

## Required Railway variables

- `MYSQL_URL` — reference to the Academy MySQL service
- `ADMIN_TOKEN` — protects all `/v1/admin/*` routes
- `NODE_ENV=production`

Temporary rollback/migration variables may remain while Postgres is retained:

- `DATABASE_URL` — legacy Postgres connection, rollback only
- `MYSQL_SHADOW_URL` — one-time migration reference; not used by the MySQL runtime

Optional outbound integrations:

- `NEW_APPLICATION_WEBHOOK_URL` — receives a JSON event whenever an application is stored
- `APPLICATION_ACK_WEBHOOK_URL` — receives candidate identity data for an acknowledgement provider

Do not commit any secret value into Git.

## Candidate flow

```
Landing
→ Apply page
→ Form start
→ Application submit
→ Academy Candidate API
→ MySQL (`hangdoi_academy`)
→ Candidate ID
→ Thank-you page
→ Academy operations
```

Candidate ID format:

`MCP01-...`

## Tracked funnel events

- `landing_view`
- `apply_view`
- `form_start`
- `form_submit_client`
- `application_received`
- `thank_you_view`

UTM fields retained:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`

Default campaign:

`media_career_cohort01`

## Pipeline stages

1. `APPLICATION_COMPLETED`
2. `QUALIFIED`
3. `SELECTION_INVITED`
4. `SELECTION_CONFIRMED`
5. `SELECTION_ATTENDED`
6. `PASS`
7. `WAITLIST`
8. `LOST`
9. `ADMITTED`
10. `ENROLLED`

Every stage change is written to stage history.

## Candidate operations fields

- Owner
- Next Action
- Next Action Date
- Lost Reason
- Internal Notes

Standard Lost Reasons:

- Tuition
- Schedule
- Parents / Family
- Location
- Career Uncertainty
- Chose Job
- Another Program
- No Response
- Failed Qualification
- Failed Selection
- Not Ready
- Other

## Anti-spam

The public form contains a honeypot field.

API limits are intentionally conservative:

- event tracking: 200 requests / 10 minutes / IP / route
- application submission: 10 requests / hour / IP / route

Rate-limit state is ephemeral and intentionally does not persist IP addresses to the candidate database.

## P1 dashboard

The internal dashboard supports:

- 7 / 30 / 90 / 365 day windows
- funnel conversion
- application source
- top content attribution
- unread application notifications
- candidate search/filter
- stage changes
- candidate detail
- Owner / Next Action
- Lost Reason / notes
- stage history
- CSV export

## Payment

P1 must remain:

**Application ON — Payment OFF**

Do not add:
- checkout
- QR payment
- deposits
- seat fees

until Legal & Enrollment P2 is approved.

## Deployment safety

GitHub Pages deploy publishes only Academy static assets/routes.

Candidate API is deployed separately on Railway.

A failure in Candidate API must not alter or redeploy `hangdoistudio.vn`.

Before merging infrastructure changes:
1. compare branch with `main`
2. verify no CNAME/root/Production files changed
3. merge through PR
4. confirm GitHub Pages workflow success
5. deploy Candidate API from latest `main`
6. confirm Railway healthcheck success

## Database cutover note

On 25/09/2026 the Academy data layer was standardized from PostgreSQL to MySQL.

Cutover verification:
- MySQL 8.4 service deployed with persistent 500 MB Railway volume
- schema initialized successfully
- shadow migration copied and verified all 10 Academy tables
- migration counts matched exactly at cutover
- `media_career_events`: 43 → 43
- `media_career_applications`: 0 → 0
- Candidate API MySQL cutover completed on commit `486b4e3ca569e9995d3b7385664ae56c187e9a7f`
- transactional startup smoke test exercises the production application INSERT/UPSERT path and rolls back; deployment logged `[mysql-runtime] smoke_ok`
- live `/health` returned HTTP 200 after MySQL cutover
- public selection lookup returned the expected HTTP 404 for a nonexistent token, confirming live MySQL reads

The live Candidate API remains:

`candidate-api-v2`

Postgres is intentionally retained for rollback until the MySQL cutover is considered stable. Do not delete it during the stabilization window.
