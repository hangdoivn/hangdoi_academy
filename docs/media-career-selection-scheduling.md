# Media Career Program — P2C Selection Scheduling

## Purpose

P2C turns a Qualified candidate into a scheduled Selection appointment with a unique confirmation link.

Flow:

```
QUALIFIED
→ Save Selection Schedule
→ Copy Invitation
→ Send via approved communication channel
→ Mark Invitation Sent
→ SELECTION_INVITED
→ Candidate opens confirmation link
→ CONFIRMED / DECLINED
→ SELECTION_CONFIRMED when candidate confirms
→ Admin marks attendance
→ SELECTION_ATTENDED
→ Selection Assessment
```

## CRM fields

Each candidate may have one active Selection appointment containing:

- Selection start
- Duration
- Timezone
- Mode: ONSITE / ONLINE
- Location or meeting link
- Invitation note
- Preparation note
- Candidate response note
- Status

## Appointment statuses

- `DRAFT`
- `INVITED`
- `CONFIRMED`
- `DECLINED`
- `ATTENDED`
- `NO_SHOW`
- `CANCELLED`

P2C currently exposes normal operating actions for:

- Save Draft
- Mark Invitation Sent
- Candidate Confirm / Decline
- Mark Attended

No-show/cancel handling remains an internal/manual ops decision for now.

## Public confirmation URL

Format:

`https://academy.hangdoiproduction.com/media-career-program/selection/?token=<opaque-token>`

The token is random and specific to one Selection appointment.

The public endpoint exposes only:

- candidate name
- Candidate ID
- date/time
- duration
- mode
- location/meeting link
- invitation/preparation notes
- appointment status

It does not expose:

- email
- phone
- assessment score
- internal notes
- other application answers

## Candidate response

### CONFIRMED

Automatically updates:

- appointment status → `CONFIRMED`
- pipeline → `SELECTION_CONFIRMED`
- stage history → changed by `candidate`

### DECLINED

Updates only:

- appointment status → `DECLINED`
- candidate response note

Do not automatically mark a Declined candidate LOST. The team may:

- reschedule;
- clarify availability;
- move to WAITLIST;
- mark LOST with the correct Lost Reason.

## Mark Invitation Sent

Before marking an invitation sent, the CRM requires:

- Selection date/time
- Location or meeting link

The action updates:

- appointment → `INVITED`
- pipeline → `SELECTION_INVITED`

## Mark Attended

After the candidate actually attends:

- appointment → `ATTENDED`
- pipeline → `SELECTION_ATTENDED`

Only then should the final Selection Assessment normally be completed.

## Recommended invitation process

1. Save Schedule.
2. Click Copy Invitation.
3. Send the copied text through the approved communication channel.
4. Click Mark Invitation Sent.
5. Wait for candidate confirmation.
6. If confirmed, CRM automatically changes to `SELECTION_CONFIRMED`.
7. On Selection Day, click Mark Attended after arrival/completion.
8. Complete Selection Assessment.

## Rescheduling

Update the same Selection Schedule and send the updated invitation again.

Do not create duplicate candidate records for rescheduling.

## Security

The public confirmation token behaves like a bearer link.

Do not:

- post a candidate's confirmation URL publicly;
- include it in public social content;
- reuse another candidate's token;
- paste tokens into shared public documents.

## Important state distinction

`SELECTION_INVITED` = invitation has been sent.

`SELECTION_CONFIRMED` = candidate has actively confirmed.

`SELECTION_ATTENDED` = candidate actually attended.

These states should not be collapsed.
