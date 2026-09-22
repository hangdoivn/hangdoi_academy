# Media Career Program — P4A Launch & Acquisition Runbook

## Current public mode

Until `program_registration_status = CONFIRMED`:

**PUBLIC MODE = INTEREST ONLY**

Public CTA:

`Register Interest`

Do not use candidate-facing CTA such as:

- Apply now
- Apply for Selection
- Reserve your seat
- Admission open
- Pay deposit
- Enroll now

The public form collects interest/background and stores candidates as:

`INTEREST_REGISTERED`

Formal recruitment/Selection remains API-blocked.

## Canonical URLs

Landing:

`https://academy.hangdoistudio.vn/media-career-program/`

Interest form:

`https://academy.hangdoistudio.vn/media-career-program/apply/`

All distributed links should carry UTM parameters.

## Campaign convention

Fixed campaign:

`utm_campaign=media_career_cohort01`

Use lowercase, hyphenated Content IDs.

Examples:

- `reel01-career-gap`
- `reel02-production-reality`
- `post01-career-path`
- `post02-role-map`
- `story01-faq-tuition`
- `direct-outreach-01`
- `student-referral`
- `partner-community-01`

Avoid changing an existing Content ID after publishing.

## Source convention

Recommended normalized values:

| Channel | utm_source | Typical utm_medium |
| --- | --- | --- |
| Instagram | instagram | organic_social / paid_social |
| Facebook | facebook | organic_social / paid_social |
| TikTok | tiktok | organic_social / paid_social |
| Threads | threads | organic_social |
| Zalo direct | zalo | message |
| Referral | referral | referral |
| Partner/community | partner | referral |
| Offline QR | offline | qr |

Do not encode campaign names into `utm_source`.

## Link Builder

The internal CRM contains:

**Launch & Acquisition → Campaign Link Builder**

Input:

- Source
- Medium
- Content ID

Output:

- tracked Landing URL
- tracked Register URL

Prefer sending the Landing URL for cold traffic.

Use direct Register URL only when the person already understands the program.

## Initial launch content system

The goal is not to publish many unrelated posts. Each asset should answer one major candidate objection or information gap.

### A. Career gap

Question:

> “Biết quay/chụp rồi thì vì sao vẫn khó đi làm?”

Core message:

Tutorial skill ≠ production readiness.

Suggested Content IDs:

- `reel01-career-gap`
- `post01-production-gap`

### B. What Production Ready means

Show:

- brief
- pre-production
- camera/light
- teamwork
- data
- post
- QC
- delivery

Suggested Content ID:

`reel02-production-ready`

### C. Career roles

Explain:

```
Media Assistant
→ Photographer / Camera / Editor
→ Lead Specialist
→ DOP / Lead Photographer / Post Lead
```

Suggested Content ID:

`post02-role-map`

### D. Four-month system

Explain:

1. Control the Tools
2. Make Commercial Images
3. Build the Output
4. Work Like a Professional

Suggested Content ID:

`carousel01-four-month-system`

### E. Real production environment

Show the type of production environment candidates will learn around:

- F&B
- hospitality
- advertising
- lifestyle
- commercial content

Do not imply a specific client guarantees student participation.

Suggested Content ID:

`reel03-production-environment`

### F. Tuition/value explanation

The 40M proposition should answer:

> “Why not just self-learn or start working?”

Explain the value as a system:

- structured curriculum
- mentorship
- hands-on practice
- equipment access
- commercial production workflow
- feedback/rework
- portfolio
- competency profile
- career direction

Do not frame tuition as payment for a Production position.

Suggested Content ID:

`post03-tuition-value`

### G. FAQ / objection handling

Priority questions:

- Chưa biết camera có tham gia được không?
- Có cần mua camera không?
- Có cần portfolio không?
- Học xong có chắc chắn được nhận vào Hang Đôi không?
- Career income framework nghĩa là gì?
- 40M bao gồm gì?
- Lịch học như thế nào? — only publish after schedule is finalized.
- Khi nào bắt đầu? — only publish after start date is finalized.

Suggested Content IDs:

- `faq01-no-camera`
- `faq02-employment`
- `faq03-tuition`

## Distribution sequence

Before formal recruitment opens, use:

```
Awareness
→ Program Understanding
→ Role/Career Understanding
→ Trust / Production Environment
→ Tuition Clarity
→ Register Interest
```

Do not push cold audiences directly into a payment/enrollment action.

## Traffic rules

For every public asset:

1. assign one Content ID;
2. generate the tracked URL in CRM;
3. use that URL consistently for that asset;
4. do not reuse one Content ID for different creatives;
5. check CRM source/content performance before scaling.

## Metrics

Current P1/P4 tracking can observe:

- landing_view
- apply_view
- form_start
- application_received
- thank_you_view
- source
- medium
- campaign
- content

Until Formal Application opens, interpret `application_received` in analytics as **interest intake received** for legal/operational purposes.

Primary pre-launch acquisition metrics:

- Landing → Register page rate
- Register page → Form Start rate
- Form Start → Interest Received rate
- Interest Received by Source
- Interest Received by Content ID

Do not optimize only for views/reach.

## Formal Application switch

After `program_registration_status = CONFIRMED`, do not silently keep old messaging.

Required launch-switch review:

1. confirm approved public wording;
2. update Landing CTA;
3. update form title/copy;
4. update confirmation copy;
5. confirm backend new records enter `APPLICATION_COMPLETED`;
6. test formal Selection stages;
7. create new Content IDs for formal recruitment creatives.

Historical Interest traffic must remain attributable separately.

## Target

Cohort 01 target remains:

**10 ENROLLED**

Acquisition should be managed against candidate pipeline coverage, not raw form count.

The CRM Cohort dashboard shows:

- target
- remaining to enroll
- PASS
- WAITLIST
- coverage
- coverage gap
