# Media Career Program — P2B Admission Draft Runbook

## Purpose

P2B prepares an internal Admission Draft for candidates who have passed Selection.

It does **not** send an Admission Letter and does **not** collect payment.

Current gate:

**LEGAL GATE = BLOCKED**

Until Legal & Enrollment review is approved, the system must keep:

- Admission Send OFF
- Payment OFF
- Checkout OFF
- Deposit OFF
- Seat fee OFF
- Pipeline transition to ADMITTED manual/blocked by process

## Eligibility

An Admission Draft may be created only when the candidate pipeline stage is:

`PASS`

The API rejects draft creation for other stages.

## Admission Draft fields

- Status: DRAFT / READY_FOR_LEGAL
- Program name
- Cohort
- Tuition amount
- Proposed payment plan
- Proposed start date
- Response deadline
- Schedule note
- Admission note
- Prepared by

Default tuition:

**40,000,000 VND**

Default proposed payment plan:

**40,000,000 VND once or 10,000,000 VND × 4 installments**

These values remain draft information until the applicable legal/enrollment structure is approved.

## Status definitions

### DRAFT

Internal preparation is incomplete.

### READY_FOR_LEGAL

Internal content is complete enough for Legal/Enrollment review.

This status does **not** mean Admission is approved or may be sent.

## Hard gate

The API currently returns:

`admissionLegalGate = BLOCKED`

The send endpoint intentionally returns HTTP 423:

`Admission sending is blocked until Legal & Enrollment gate is approved`

Do not bypass this restriction by:

- sending the copied draft manually as an official Admission Letter;
- adding a payment QR code;
- asking for a deposit;
- asking a candidate to transfer tuition to reserve a seat;
- changing PASS to ADMITTED without the approved enrollment flow.

## Required legal decisions before Send can be enabled

Legal review must confirm at minimum:

1. Which legal entity operates the program.
2. Which entity may collect the 40M tuition.
3. Whether the program requires vocational-education registration/licensing.
4. Permitted program naming and public claims.
5. Permitted completion/certificate wording.
6. Required Enrollment Agreement terms.
7. Tuition, cancellation, refund and deferral policy.
8. Invoice/tax handling.
9. Conditions for real-client production exposure.
10. Academy → Production recruitment separation.

## After Legal approval

Do not merely remove the BLOCKED text.

P2B must then be upgraded in a separate reviewed change that adds:

- legal approval record/version
- approved Admission Letter template
- Enrollment Agreement version
- Tuition & Refund Policy version
- official Send action
- send timestamp
- candidate acceptance status
- response deadline handling
- audit trail
- only then transition PASS → ADMITTED

Payment remains a separate P3 gate.

## Internal workflow

```
PASS
↓
Create Admission Draft
↓
Complete dates / notes / payment proposal
↓
READY_FOR_LEGAL
↓
Legal & Enrollment review
↓
[CURRENT SYSTEM STOPS HERE]
```

## Safety rule

**PASS ≠ ADMITTED ≠ ENROLLED ≠ EMPLOYEE**

These states must remain distinct in CRM and communications.
