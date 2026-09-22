# Media Career Program — P3 Legal & Enrollment Readiness Gate

> Internal operating checklist. This is not a legal opinion.
>
> Legal snapshot date: **22 September 2026**.
>
> Admission Send and Payment remain **BLOCKED IN CODE** regardless of checklist completion. A later reviewed code change is required to unlock them.

## Current legal framework to review

Primary current instruments:

1. **Law on Vocational Education No. 124/2025/QH15**
   - issued 10 December 2025;
   - effective 1 January 2026.
2. **Decree No. 95/2026/NĐ-CP**
   - issued/effective 31 March 2026;
   - details provisions of the Law on Vocational Education.
3. **Decree No. 361/2026/NĐ-CP**
   - issued/effective 17 September 2026;
   - regulates investment/activity conditions in vocational education, higher education and education quality accreditation.
4. **Circular No. 55/2026/TT-BGDĐT**
   - issued/effective 30 June 2026;
   - regulates vocational-education training-program standards.
5. **Labour Code No. 45/2019/QH14 — Article 61**
   - employer apprenticeship/traineeship to work for that employer is a separate legal path;
   - in that path, the employer may not charge tuition.

Because Decree 361/2026 is very recent, the exact application to Hang Đôi’s entity/program should be confirmed by legal counsel and, where appropriate, the competent Da Nang education authority before formal admission or tuition collection.

## Working legal direction — to be confirmed

Law 124/2025/QH15 recognizes an **enterprise** as a type of entity that may participate in vocational education. When conditions are met, an enterprise may implement:

- elementary-level training programs; and
- other vocational training programs.

The law also provides that a learner who completes another vocational training program and meets the program requirements may receive a training certificate from the head of the entity conducting vocational education activity.

The law states that certificate-granting programs are not subject to vocational-education activity licensing, while entities conducting vocational education must register program information in the specialized vocational-education database before recruitment/training.

These points are a **legal lead**, not a final determination that Hang Đôi may immediately sell/enroll the current 4-month program. The exact program classification, entity conditions, database procedure, certificate authority and disclosure obligations must be confirmed.

## Public intake safe mode

Because Article 20 requires program information to be registered in the specialized vocational-education database **before recruitment/enrollment activity and training**, Hang Đôi should not treat the current public form as Formal Selection while `program_registration_status` remains unresolved.

Current system behavior:

```
program_registration_status != CONFIRMED
→ Public CTA = REGISTER INTEREST
→ New record = INTEREST_REGISTERED
→ Formal stage advancement is API-blocked
→ No Selection invitation
→ No Admission Send
→ No Payment
```

After program registration is formally confirmed and the reference is stored:

```
program_registration_status = CONFIRMED
→ formal Selection prerequisites may be reviewed/unlocked internally
→ public intake still remains INTEREST_REGISTERED
→ Formal Application requires a separate reviewed launch change
```

This is a risk-control design, not a legal conclusion that every expression-of-interest activity falls outside "tuyển sinh". Counsel/authority should confirm the acceptable boundary.

The public endpoint is intentionally hard-coded to `INTEREST_REGISTERED` in the current production version. Program registration alone does not auto-switch the public funnel into Formal Application.

## Non-negotiable employment separation

The paid Academy program must not be structured or marketed as:

> Pay tuition to be trained by Hang Đôi Production so you can work for Hang Đôi Production.

Article 61 of the Labour Code provides a separate employer apprenticeship/traineeship route. Where an employer recruits people into apprenticeship/traineeship to work for itself, the employer may not charge tuition.

Therefore:

**Academy Admission ≠ Production Employment Offer**

**PASS ≠ ADMITTED ≠ ENROLLED ≠ EMPLOYEE**

Production recruitment must remain a later, separate decision based on:

- Production Ready result;
- competency;
- role fit;
- headcount;
- conduct;
- normal employment conditions.

## Legal Readiness checklist

### 1. Operating entity

Confirm the exact legal entity that:

- operates the program;
- signs enrollment documents;
- receives tuition;
- issues invoices;
- carries the education/training obligations.

Evidence examples:

- business registration;
- business/activity scope;
- legal memo;
- authority confirmation.

CRM field:

`operating_entity_status`

### 2. Program classification

Confirm how the 4-month Media Career Program is classified under Law 124/2025/QH15.

Preferred question for counsel/authority:

> Can the program be operated by the selected Hang Đôi enterprise as an “other vocational training program” implemented by an enterprise participating in vocational education?

Do not infer this from branding alone.

CRM field:

`program_classification_status`

### 3. Activity conditions under current regulations

Confirm every applicable condition under the current implementing framework, including Decree 361/2026/NĐ-CP and Decree 95/2026/NĐ-CP.

Review at minimum:

- entity eligibility;
- facilities;
- trainers/teachers;
- equipment;
- training location;
- internal quality requirements;
- public disclosure/data obligations;
- any registration/notification procedures.

CRM field:

`activity_conditions_status`

### 4. Program registration before recruitment/training

Law 124/2025/QH15 requires entities conducting vocational education activity to register training-program information in the specialized vocational-education database before recruitment and training.

Confirm:

- which database/process applies;
- competent authority;
- required data/documents;
- timing;
- proof/reference number.

CRM field:

`program_registration_status`

### 5. Curriculum / program standard

Confirm that the official program document satisfies the applicable current standard.

The official program should at minimum define:

- program name/classification;
- objectives;
- learning outcomes;
- duration/volume;
- modules;
- practical content;
- assessment;
- graduation/completion conditions;
- equipment/resources;
- trainer requirements.

CRM field:

`curriculum_standard_status`

### 6. Certificate wording and authority

Before any public promise about certificates, confirm:

- whether a certificate is appropriate;
- exact legal name of the certificate;
- issuing entity/person;
- completion conditions;
- serial/record/data requirements if any;
- what the certificate legally represents.

Do not use wording that implies a diploma/qualification the program does not legally award.

CRM field:

`certificate_wording_status`

### 7. Tuition disclosure

Confirm the lawful tuition-setting and disclosure mechanism for the chosen program/entity structure.

Public materials must clearly separate:

- tuition;
- optional/mandatory fees;
- equipment access;
- payment schedule;
- taxes/invoice treatment;
- refund/cancellation/deferral rules.

CRM field:

`tuition_disclosure_status`

### 8. Enrollment Agreement

Prepare a signed Enrollment Agreement that is legally reviewed and consistent with the actual product.

Minimum subjects:

- parties;
- program;
- duration/schedule;
- tuition/payment dates;
- rights/obligations;
- attendance/assessment;
- equipment;
- safety;
- data/privacy;
- real production exposure;
- withdrawal;
- refund/deferral;
- discipline/termination;
- force majeure;
- dispute/contact mechanism;
- no employment guarantee.

CRM field:

`enrollment_agreement_status`

### 9. Refund / cancellation / deferral policy

The policy must answer at minimum:

- applicant withdraws before start;
- Academy cancels/postpones;
- student leaves during Month 1/2/3/4;
- installment is late;
- medical/emergency deferral;
- student is removed for conduct/safety;
- scholarship interaction;
- refund timing/method.

CRM field:

`refund_deferral_status`

### 10. Invoice / tax treatment

Accounting/tax review must confirm:

- entity receiving tuition;
- invoice type/timing;
- tax treatment;
- accounting recognition;
- scholarship/discount treatment;
- installment treatment.

CRM field:

`invoice_tax_status`

### 11. Real-client production exposure

Law 124 recognizes learner participation in enterprise practice/work and provides for remuneration where learners directly participate in labour or create products under applicable arrangements.

Before using students in real client work, define:

- educational purpose;
- supervision;
- safety;
- client confidentiality;
- data/IP/model releases;
- whether output is used commercially;
- remuneration where legally required;
- working hours/travel/night work controls;
- student opt-out where appropriate.

CRM field:

`production_exposure_status`

### 12. Academy ↔ Production employment separation

Review all:

- landing-page wording;
- application wording;
- Selection scripts;
- Admission text;
- Enrollment Agreement;
- career-path materials;
- bonus wording;
- Production recruitment process.

Required message:

> Training admission and Production employment are separate processes.

Avoid:

- job guarantee tied to tuition;
- tuition reimbursement that functions like a deposit/security;
- employment security/deposit language;
- representations that tuition purchases a position.

CRM field:

`employment_separation_status`

### 13. Privacy / marketing terms

Confirm:

- applicant-data collection purpose;
- data retention/access;
- selection/enrollment processing;
- sensitive-document handling;
- marketing consent separated from mandatory application processing;
- deletion/retention workflow;
- access control for Candidate CRM.

CRM field:

`privacy_terms_status`

## Status vocabulary

Each checkpoint uses:

- `PENDING` — unresolved / evidence incomplete
- `CONFIRMED` — formally reviewed and evidence/reference available
- `NOT_APPLICABLE` — formally reviewed and determined not applicable

Do not mark `CONFIRMED` merely because a team member believes the requirement is satisfied.

## References to store

CRM provides:

- Legal / counsel reference
- Authority reference
- Reviewed by
- Reviewed at
- Notes

Examples of acceptable references:

- signed legal memo;
- email/letter from counsel;
- written guidance/reference from competent authority;
- program registration reference;
- approved policy/document version.

## Technical gate

Current API behavior is intentionally independent of checklist completion:

```
Admission Send = BLOCKED_IN_CODE
Payment = BLOCKED_IN_CODE
```

Even 13/13 confirmed does **not** unlock either feature.

The CRM also contains a separate **Final Legal Approval** evidence record:

- decision: `PENDING / APPROVED / REJECTED`;
- approved by;
- approval reference;
- approval timestamp.

The API will not accept `APPROVED` unless:

- every checklist item is `CONFIRMED` or formally `NOT_APPLICABLE`;
- an approver is named;
- an approval reference is supplied;
- a counsel or authority reference is already stored.

Even `Final Legal Approval = APPROVED` still does **not** unlock Admission Send or Payment.

Unlock requires a separate future PR after formal legal signoff and implementation review.

## Required gate before future unlock PR

A future unlock PR must not be created until all of the following are available:

- 13-checkpoint review completed or formally marked N/A with basis;
- counsel/authority reference stored;
- operating entity confirmed;
- program registration process completed where required;
- approved Enrollment Agreement;
- approved tuition/refund/deferral policy;
- invoice/tax treatment confirmed;
- approved candidate-facing Admission Letter;
- privacy terms approved;
- Production employment separation verified;
- named person authorized to approve launch.

Only then should the product team design:

```
PASS
→ Admission Send
→ Candidate Acceptance
→ ADMITTED
→ Enrollment Agreement
→ Payment
→ ENROLLED
```

Payment must remain a separate implementation/review step.


## Source validation snapshot — 22 September 2026

Confirmed current instruments used for this gate:

- Law No. 124/2025/QH15 — Law on Vocational Education, effective 01 January 2026.
- Decree No. 95/2026/NĐ-CP — details provisions of the Law on Vocational Education, effective 31 March 2026.
- Circular No. 55/2026/TT-BGDĐT — vocational-education training-program standards, effective 30 June 2026.
- Decree No. 361/2026/NĐ-CP — investment/activity conditions in vocational education, effective 17 September 2026.

Important statutory leads that must still be applied to Hang Đôi's actual entity/program facts:

- enterprises may be entities participating in vocational education and, when qualified, may implement elementary and other vocational training programs;
- other vocational training programs may lead to a training certificate when program requirements are satisfied;
- certificate-granting programs are outside the vocational-education activity licensing requirement;
- program information must be registered in the specialized vocational-education database before recruitment/training;
- the employer apprenticeship/traineeship route to work for that employer is legally separate and does not permit tuition collection.

Do not convert these leads into a launch decision without counsel/authority review.
