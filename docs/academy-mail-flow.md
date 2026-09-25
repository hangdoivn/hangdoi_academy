# Hang Đôi Academy — Mail flow

## Mục tiêu

Landing Media Career Program chỉ cần hai luồng email tự động sau khi người dùng gửi biểu mẫu thành công:

1. **Email báo team** tới mailbox tuyển dụng.
2. **Email xác nhận ứng viên** tới đúng email vừa đăng ký.

Không tự động gửi Selection / Admission / Payment email trong flow này.

## Mailbox

- Sender / reply mailbox: `tuyendung@hangdoistudio.vn`
- SMTP host: `smtp.hostinger.com`
- SMTP port: `465`
- Encryption: SSL/TLS
- Fallback nếu gặp lỗi mã hóa: port `587` + STARTTLS

## Railway variables

Non-secret variables:

- `ACADEMY_MAIL_ENABLED=false|true`
- `ACADEMY_MAIL_REQUIRED=false|true`
- `ACADEMY_SMTP_HOST=smtp.hostinger.com`
- `ACADEMY_SMTP_PORT=465`
- `ACADEMY_SMTP_SECURE=true`
- `ACADEMY_SMTP_USER=tuyendung@hangdoistudio.vn`
- `ACADEMY_MAIL_FROM=Hang Đôi Academy <tuyendung@hangdoistudio.vn>`
- `ACADEMY_MAIL_REPLY_TO=tuyendung@hangdoistudio.vn`
- `ACADEMY_MAIL_TEAM_TO=tuyendung@hangdoistudio.vn`

Secret variable:

- `ACADEMY_SMTP_PASS` — mailbox password. Never commit this value to GitHub, docs, logs, or frontend source.

Safe activation order:

1. Set `ACADEMY_SMTP_PASS`.
2. Set `ACADEMY_MAIL_ENABLED=true`.
3. Confirm `/health/outbound` reports `email.configured=true`.
4. In Academy Admin → Hệ thống → Gửi thử.
5. Confirm the test delivery reaches `DELIVERED` and the mailbox receives the message.
6. Only then set `ACADEMY_MAIL_REQUIRED=true`.

If `ACADEMY_MAIL_REQUIRED=true` and SMTP becomes unavailable or incomplete, `/health/outbound` returns unhealthy and Academy Ops Monitor opens/updates the normal production incident.

## Durable delivery

Email reuses `media_career_outbound_deliveries`.

Delivery types:

- `EMAIL_TEAM_NEW_APPLICATION`
- `EMAIL_CANDIDATE_ACK`
- `CONNECTION_TEST_EMAIL`

Endpoint key:

- `ACADEMY_SMTP`

The existing worker handles:

- durable queue persistence;
- claim / lease;
- retries;
- six-attempt normal backoff;
- failed delivery visibility;
- manual retry from Admin;
- candidate-level delivery history.

A form submission succeeds independently of the mail network. SMTP failure must never lose the application record.

## Candidate email

Subject:

`Hang Đôi Academy đã ghi nhận đăng ký của bạn`

Content:

- confirms Hang Đôi received the Media Career Program — Cohort 01 interest form;
- shows Candidate ID;
- says the team will contact them when more information is needed or when there is a relevant update;
- explicitly says no payment or gear preparation is needed at this stage.

The copy intentionally avoids Selection / Admission / Payment promises.

## Team email

Subject:

`[Hang Đôi Academy] Đăng ký mới · <Tên ứng viên>`

Contains:

- full name;
- phone;
- email;
- Candidate ID;
- source/content attribution;
- submitted time;
- link to Academy Admin.

The team message sets Reply-To to the candidate email when available, so a normal reply starts a direct conversation with the applicant.

## Idempotency

Queue uniqueness remains `(candidate_code, delivery_type)`.

SMTP messages use a deterministic `Message-ID` derived from the outbound delivery ID. Delivery semantics remain at-least-once: an ambiguous SMTP/network timeout can theoretically create a duplicate, but the stable Message-ID reduces duplicate threading/noise in compatible mail systems.

## Current production state

As of 2026-09-25:

- mailbox send/receive test: PASS;
- SMTP adapter deployed: YES;
- SMTP non-secret variables configured: YES;
- `ACADEMY_SMTP_PASS`: NOT CONFIGURED;
- `ACADEMY_MAIL_ENABLED=false`;
- `ACADEMY_MAIL_REQUIRED=false`;
- automatic candidate/team email: NOT ACTIVE.
