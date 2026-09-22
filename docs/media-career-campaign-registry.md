# Media Career Program — Campaign Registry

## Purpose

The Campaign Registry turns UTM tracking into an operating system for Cohort 01 acquisition.

Each public creative, referral source, partner distribution or direct-outreach campaign should have its own stable `content_id`.

## Current mode

Public intake is:

`INTEREST ONLY`

A campaign may generate Interest records, but it does not imply Formal Application, Selection, Admission or Enrollment is open.

## Registry fields

- Content ID
- Title
- Source
- Medium
- Campaign
- Status
- Owner
- Asset URL
- Publish URL
- Notes

Fixed campaign:

`media_career_cohort01`

## Statuses

### IDEA

Angle exists but creative has not entered production.

### DRAFT

Creative/copy is being produced.

### READY

Asset is approved and ready to publish.

### PUBLISHED

Asset is live and traffic may be attributed.

### PAUSED

Distribution is intentionally stopped but historical attribution is retained.

### ARCHIVED

No longer an active campaign.

Do not delete historical Content IDs simply because a campaign ended.

## Content ID rule

Use lowercase and hyphens.

Examples:

- `reel01-career-gap`
- `post01-role-map`
- `video02-production-ready`
- `direct-outreach-01`
- `partner-community-01`

A Content ID should identify one creative/distribution unit.

Do not reuse the same Content ID for unrelated creatives.

## Performance metrics

The CRM calculates performance for the selected 7/30/90/365 day window.

### Landing

Unique sessions with:

`landing_view`

for the Content ID.

### Register

Unique sessions with:

`apply_view`

for the Content ID.

### Start

Unique sessions with:

`form_start`

for the Content ID.

### Interest

Number of stored candidate Interest records carrying that Content ID.

### Conversion

`Interest / Landing unique sessions`

This is directional acquisition conversion, not Enrollment conversion.

## Workflow

1. Create a Content ID.
2. Choose Source + Medium.
3. Generate tracked Landing/Register URLs.
4. Add Title / Owner / Asset URL.
5. Save campaign as DRAFT.
6. After approval, change to READY.
7. Publish.
8. Add Publish URL and set PUBLISHED.
9. Review traffic/Interest conversion.
10. Record learning in Notes.
11. Pause/archive without deleting history.

## Recommended operating review

Twice per week during acquisition:

- inspect PUBLISHED campaigns;
- compare Landing → Register;
- compare Register → Start;
- compare Start → Interest;
- inspect Interest quality manually in Candidate CRM;
- identify content that creates the right candidate profile, not only high traffic.

## Important limitation

The Campaign Registry currently measures owned first-party funnel events.

It does not automatically import:

- Instagram reach/views;
- Facebook reach;
- TikTok views;
- paid-platform spend;
- CPM/CPC.

Those may be added later through ad/social connectors if useful.

## Quality rule

Do not scale a creative solely because it has the highest raw Interest count.

Also review:

- candidate background;
- career intent;
- geography;
- track interest;
- later Selection quality once Formal Selection is legally opened.

## Legal-safe language

Until Formal Application is explicitly unlocked:

Use:

- Register Interest
- Learn more
- Get Cohort 01 updates

Avoid:

- Apply now
- Admission open
- Reserve your seat
- Pay deposit
- Enrollment open

## Data integrity

If a published creative was distributed with the wrong Content ID:

- do not overwrite historical campaign identity if it would corrupt attribution;
- create a corrected Content ID where necessary;
- document the issue in Notes.
