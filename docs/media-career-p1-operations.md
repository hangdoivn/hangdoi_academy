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

- `Postgres` — persistent candidate/event database
- `candidate-api-v2` — production Candidate API

The API root directory is:

`/api`

Healthcheck:

`GET /health`

## Required Railway variables

- `DATABASE_URL` — reference to Postgres service
- `ADMIN_TOKEN` — protects all `/v1/admin/*` routes
- `NODE_ENV=production`

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
→ Postgres
→ Candidate ID
→ Thank-you page
→ CRM screening
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

## Current cleanup note

Two temporary Railway services were created during initial testing:
- `candidate-api`
- `candidate-api-p1-test`

They have been marked for removal. Railway requires account 2FA confirmation to apply that destructive cleanup. They are not used by the public application flow.

The live service is:

`candidate-api-v2`
