import express from "express";
import cors from "cors";
import helmet from "helmet";
import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway.internal")
    ? false
    : { rejectUnauthorized: false }
});

const allowedOrigins = new Set([
  "https://academy.hangdoistudio.vn",
  "https://academy.hangdoiproduction.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "300kb" }));
app.set("trust proxy", 1);

const rateBuckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateBuckets.entries()) {
    if (value.resetAt <= now) rateBuckets.delete(key);
  }
}, 60 * 60 * 1000).unref();

function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || "unknown"}:${req.path}`;
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      return res.status(429).json({ ok: false, error: "Too many requests" });
    }
    next();
  };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_career_cohorts (
      cohort TEXT PRIMARY KEY,
      target_enrollment INT NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'OPEN',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO media_career_cohorts (cohort, target_enrollment, status)
    VALUES ('01', 10, 'OPEN')
    ON CONFLICT (cohort) DO NOTHING;

    CREATE TABLE IF NOT EXISTS media_career_legal_readiness (
      cohort TEXT PRIMARY KEY,
      operating_entity_status TEXT NOT NULL DEFAULT 'PENDING',
      program_classification_status TEXT NOT NULL DEFAULT 'PENDING',
      activity_conditions_status TEXT NOT NULL DEFAULT 'PENDING',
      program_registration_status TEXT NOT NULL DEFAULT 'PENDING',
      curriculum_standard_status TEXT NOT NULL DEFAULT 'PENDING',
      certificate_wording_status TEXT NOT NULL DEFAULT 'PENDING',
      tuition_disclosure_status TEXT NOT NULL DEFAULT 'PENDING',
      enrollment_agreement_status TEXT NOT NULL DEFAULT 'PENDING',
      refund_deferral_status TEXT NOT NULL DEFAULT 'PENDING',
      invoice_tax_status TEXT NOT NULL DEFAULT 'PENDING',
      production_exposure_status TEXT NOT NULL DEFAULT 'PENDING',
      employment_separation_status TEXT NOT NULL DEFAULT 'PENDING',
      privacy_terms_status TEXT NOT NULL DEFAULT 'PENDING',
      counsel_reference TEXT,
      authority_reference TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      notes TEXT,
      final_approval_status TEXT NOT NULL DEFAULT 'PENDING',
      final_approval_reference TEXT,
      final_approved_by TEXT,
      final_approved_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO media_career_legal_readiness (cohort)
    VALUES ('01')
    ON CONFLICT (cohort) DO NOTHING;

    ALTER TABLE media_career_legal_readiness
      ADD COLUMN IF NOT EXISTS final_approval_status TEXT NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS final_approval_reference TEXT,
      ADD COLUMN IF NOT EXISTS final_approved_by TEXT,
      ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS media_career_applications (
      id BIGSERIAL PRIMARY KEY,
      candidate_code TEXT NOT NULL UNIQUE,
      cohort TEXT NOT NULL DEFAULT '01',
      full_name TEXT NOT NULL,
      date_of_birth DATE,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      email_normalized TEXT NOT NULL,
      city TEXT,
      current_status TEXT,
      preferred_track TEXT,
      experience_level TEXT,
      portfolio_url TEXT,
      pipeline_stage TEXT NOT NULL DEFAULT 'APPLICATION_COMPLETED',
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      referrer TEXT,
      marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
      privacy_consent BOOLEAN NOT NULL DEFAULT TRUE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(cohort, email_normalized)
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_stage
      ON media_career_applications(pipeline_stage);
    CREATE INDEX IF NOT EXISTS idx_mcp_source
      ON media_career_applications(utm_source);
    CREATE INDEX IF NOT EXISTS idx_mcp_submitted
      ON media_career_applications(submitted_at DESC);

    ALTER TABLE media_career_applications
      ADD COLUMN IF NOT EXISTS owner TEXT,
      ADD COLUMN IF NOT EXISTS next_action TEXT,
      ADD COLUMN IF NOT EXISTS next_action_date DATE,
      ADD COLUMN IF NOT EXISTS lost_reason TEXT,
      ADD COLUMN IF NOT EXISTS internal_notes TEXT;

    CREATE TABLE IF NOT EXISTS media_career_stage_history (
      id BIGSERIAL PRIMARY KEY,
      application_id BIGINT NOT NULL REFERENCES media_career_applications(id) ON DELETE CASCADE,
      candidate_code TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      changed_by TEXT NOT NULL DEFAULT 'admin',
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_stage_history_application
      ON media_career_stage_history(application_id, changed_at DESC);

    CREATE TABLE IF NOT EXISTS media_career_assessments (
      id BIGSERIAL PRIMARY KEY,
      application_id BIGINT NOT NULL UNIQUE REFERENCES media_career_applications(id) ON DELETE CASCADE,
      visual_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      learning_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      execution_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      behaviour_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      motivation_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      assessor TEXT,
      selection_notes TEXT,
      interview_notes TEXT,
      decision TEXT NOT NULL DEFAULT 'PENDING',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_assessment_decision
      ON media_career_assessments(decision, updated_at DESC);

    CREATE TABLE IF NOT EXISTS media_career_admissions (
      id BIGSERIAL PRIMARY KEY,
      application_id BIGINT NOT NULL UNIQUE REFERENCES media_career_applications(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      program_name TEXT NOT NULL DEFAULT 'Hang Đôi Media Career Program',
      cohort TEXT NOT NULL DEFAULT '01',
      tuition_amount BIGINT NOT NULL DEFAULT 40000000,
      payment_plan TEXT NOT NULL DEFAULT '40.000.000 VNĐ một lần hoặc 10.000.000 VNĐ × 4 kỳ',
      proposed_start_date DATE,
      response_deadline DATE,
      schedule_note TEXT,
      admission_note TEXT,
      prepared_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_admission_status
      ON media_career_admissions(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS media_career_selection_appointments (
      id BIGSERIAL PRIMARY KEY,
      application_id BIGINT NOT NULL UNIQUE REFERENCES media_career_applications(id) ON DELETE CASCADE,
      public_token TEXT NOT NULL UNIQUE,
      selection_start TIMESTAMPTZ,
      duration_minutes INT NOT NULL DEFAULT 90,
      timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
      mode TEXT NOT NULL DEFAULT 'ONSITE',
      location TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      invitation_note TEXT,
      prep_note TEXT,
      candidate_response_note TEXT,
      confirmed_at TIMESTAMPTZ,
      declined_at TIMESTAMPTZ,
      attended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_selection_status
      ON media_career_selection_appointments(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS media_career_events (
      id BIGSERIAL PRIMARY KEY,
      event_name TEXT NOT NULL,
      session_id TEXT,
      candidate_code TEXT,
      path TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      referrer TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_events_name_created
      ON media_career_events(event_name, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_events_session
      ON media_career_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_events_candidate
      ON media_career_events(candidate_code);

    CREATE TABLE IF NOT EXISTS media_career_notifications (
      id BIGSERIAL PRIMARY KEY,
      candidate_code TEXT,
      notification_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'UNREAD',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_notifications_status
      ON media_career_notifications(status, created_at DESC);
  `);
}

function cleanString(value, max = 5000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanString(value, 320).toLowerCase();
}

function cleanScore(value, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) return null;
  return Math.round(number * 100) / 100;
}

const legalChecklistStatuses = new Set(["PENDING", "CONFIRMED", "NOT_APPLICABLE"]);
function cleanLegalStatus(value) {
  const status = cleanString(value || "PENDING", 40).toUpperCase();
  return legalChecklistStatuses.has(status) ? status : null;
}

function candidateCode(cohort = "01") {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `MCP${cohort}-${stamp}-${rand}`;
}

function selectionToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const auth = req.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

async function postWebhook(url, payload) {
  if (!url) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) console.error("webhook_failed", response.status);
  } catch (error) {
    console.error("webhook_error", error?.message || error);
  }
}

async function recordEvent(event) {
  const allowed = new Set([
    "landing_view", "apply_view", "form_start", "form_submit_client",
    "application_received", "thank_you_view"
  ]);
  if (!allowed.has(event.eventName)) return;
  await pool.query(`
    INSERT INTO media_career_events (
      event_name, session_id, candidate_code, path,
      utm_source, utm_medium, utm_campaign, utm_content,
      referrer, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
  `, [
    event.eventName,
    cleanString(event.sessionId, 160),
    cleanString(event.candidateCode, 160),
    cleanString(event.path, 500),
    cleanString(event.utmSource, 180),
    cleanString(event.utmMedium, 180),
    cleanString(event.utmCampaign, 180),
    cleanString(event.utmContent, 180),
    cleanString(event.referrer, 1000),
    JSON.stringify(event.metadata || {})
  ]);
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "hangdoi-academy-candidate-api" });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post("/v1/events", rateLimit(10 * 60 * 1000, 200), async (req, res) => {
  try {
    const b = req.body || {};
    await recordEvent({
      eventName: cleanString(b.eventName, 80),
      sessionId: b.sessionId,
      candidateCode: b.candidateCode,
      path: b.path,
      utmSource: b.utmSource,
      utmMedium: b.utmMedium,
      utmCampaign: b.utmCampaign,
      utmContent: b.utmContent,
      referrer: b.referrer,
      metadata: typeof b.metadata === "object" && b.metadata ? b.metadata : {}
    });
    res.status(202).json({ ok: true });
  } catch (error) {
    console.error("event_record_failed", error);
    res.status(202).json({ ok: true });
  }
});

app.post("/v1/applications", rateLimit(60 * 60 * 1000, 10), async (req, res) => {
  try {
    const b = req.body || {};
    if (cleanString(b.website, 200)) {
      return res.status(201).json({ ok: true, candidateCode: "MCP01-RECEIVED" });
    }
    const fullName = cleanString(b.fullName, 160);
    const phone = cleanString(b.phone, 50);
    const email = cleanEmail(b.email);
    const city = cleanString(b.city, 160);
    const currentStatus = cleanString(b.currentStatus, 100);
    const experienceLevel = cleanString(b.experienceLevel, 100);
    const visualThinking = cleanString(b.visualThinking, 6000);
    const careerWhy = cleanString(b.careerWhy, 6000);
    const career3yr = cleanString(b.career3yr, 6000);
    const currentBarrier = cleanString(b.currentBarrier, 6000);
    const hardSkillStory = cleanString(b.hardSkillStory, 6000);
    const failureStory = cleanString(b.failureStory, 6000);
    const schedule = cleanString(b.schedule, 3000);
    const whyYou = cleanString(b.whyYou, 6000);
    const privacyConsent = b.privacyConsent === true;
    const tuitionAwareness = b.tuitionAwareness === true;

    const missing = [];
    if (!fullName) missing.push("fullName");
    if (!phone) missing.push("phone");
    if (!email || !email.includes("@")) missing.push("email");
    if (!city) missing.push("city");
    if (!currentStatus) missing.push("currentStatus");
    if (!experienceLevel) missing.push("experienceLevel");
    if (!visualThinking) missing.push("visualThinking");
    if (!careerWhy) missing.push("careerWhy");
    if (!career3yr) missing.push("career3yr");
    if (!currentBarrier) missing.push("currentBarrier");
    if (!hardSkillStory) missing.push("hardSkillStory");
    if (!failureStory) missing.push("failureStory");
    if (!schedule) missing.push("schedule");
    if (!whyYou) missing.push("whyYou");
    if (!privacyConsent) missing.push("privacyConsent");
    if (!tuitionAwareness) missing.push("tuitionAwareness");

    if (missing.length) {
      return res.status(400).json({ ok: false, error: "Missing required fields", fields: missing });
    }

    const cohort = "01";
    const existing = await pool.query(
      "SELECT candidate_code, phone FROM media_career_applications WHERE cohort = $1 AND email_normalized = $2",
      [cohort, email]
    );
    if (existing.rowCount && cleanString(existing.rows[0].phone, 50) !== phone) {
      return res.status(409).json({
        ok: false,
        error: "An application already exists for this email. Please contact Hang Đôi if you need to update it."
      });
    }
    const code = candidateCode(cohort);
    const payload = {
      ...b,
      fullName,
      phone,
      email,
      city,
      currentStatus,
      experienceLevel
    };

    const result = await pool.query(`
      INSERT INTO media_career_applications (
        candidate_code, cohort, full_name, date_of_birth, phone, email, email_normalized,
        city, current_status, preferred_track, experience_level, portfolio_url,
        utm_source, utm_medium, utm_campaign, utm_content, referrer,
        marketing_consent, privacy_consent, payload
      ) VALUES (
        $1,$2,$3,NULLIF($4,'')::date,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20::jsonb
      )
      ON CONFLICT (cohort, email_normalized)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        date_of_birth = EXCLUDED.date_of_birth,
        phone = EXCLUDED.phone,
        city = EXCLUDED.city,
        current_status = EXCLUDED.current_status,
        preferred_track = EXCLUDED.preferred_track,
        experience_level = EXCLUDED.experience_level,
        portfolio_url = EXCLUDED.portfolio_url,
        utm_source = EXCLUDED.utm_source,
        utm_medium = EXCLUDED.utm_medium,
        utm_campaign = EXCLUDED.utm_campaign,
        utm_content = EXCLUDED.utm_content,
        referrer = EXCLUDED.referrer,
        marketing_consent = EXCLUDED.marketing_consent,
        privacy_consent = EXCLUDED.privacy_consent,
        payload = EXCLUDED.payload,
        submitted_at = NOW(),
        updated_at = NOW()
      RETURNING id, candidate_code, submitted_at
    `, [
      code, cohort, fullName, cleanString(b.dateOfBirth, 20), phone, email, email,
      city, currentStatus, cleanString(b.preferredTrack, 100), experienceLevel,
      cleanString(b.portfolioUrl, 1000),
      cleanString(b.utmSource, 180), cleanString(b.utmMedium, 180),
      cleanString(b.utmCampaign, 180), cleanString(b.utmContent, 180),
      cleanString(b.referrer, 1000),
      b.marketingConsent === true, privacyConsent, JSON.stringify(payload)
    ]);

    const saved = result.rows[0];
    await recordEvent({
      eventName: "application_received",
      candidateCode: saved.candidate_code,
      path: "/media-career-program/apply/",
      utmSource: b.utmSource,
      utmMedium: b.utmMedium,
      utmCampaign: b.utmCampaign,
      utmContent: b.utmContent,
      referrer: b.referrer,
      metadata: { cohort, emailDomain: email.split("@")[1] || "" }
    });

    await pool.query(`
      INSERT INTO media_career_notifications (
        candidate_code, notification_type, payload
      ) VALUES ($1, 'NEW_APPLICATION', $2::jsonb)
    `, [
      saved.candidate_code,
      JSON.stringify({
        candidateCode: saved.candidate_code,
        fullName,
        email,
        phone,
        preferredTrack: cleanString(b.preferredTrack, 100),
        utmSource: cleanString(b.utmSource, 180),
        utmContent: cleanString(b.utmContent, 180),
        submittedAt: saved.submitted_at
      })
    ]);

    const webhookPayload = {
      type: "NEW_APPLICATION",
      candidateCode: saved.candidate_code,
      fullName,
      email,
      phone,
      preferredTrack: cleanString(b.preferredTrack, 100),
      source: cleanString(b.utmSource, 180) || "direct",
      content: cleanString(b.utmContent, 180),
      submittedAt: saved.submitted_at
    };
    void postWebhook(process.env.NEW_APPLICATION_WEBHOOK_URL, webhookPayload);
    void postWebhook(process.env.APPLICATION_ACK_WEBHOOK_URL, {
      type: "APPLICATION_ACK",
      candidateCode: saved.candidate_code,
      fullName,
      email,
      submittedAt: saved.submitted_at
    });

    res.status(201).json({
      ok: true,
      candidateCode: saved.candidate_code,
      submittedAt: saved.submitted_at
    });
  } catch (error) {
    console.error("application_submit_failed", error);
    res.status(500).json({ ok: false, error: "Unable to submit application" });
  }
});

app.get("/v1/selection/:token", rateLimit(10 * 60 * 1000, 100), async (req, res) => {
  const token = cleanString(req.params.token, 200);
  const result = await pool.query(`
    SELECT s.status, s.selection_start, s.duration_minutes, s.timezone, s.mode,
           s.location, s.invitation_note, s.prep_note, s.candidate_response_note,
           a.candidate_code, a.full_name
    FROM media_career_selection_appointments s
    JOIN media_career_applications a ON a.id = s.application_id
    WHERE s.public_token = $1
  `, [token]);
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Selection invitation not found" });
  res.json({ ok: true, selection: result.rows[0] });
});

app.post("/v1/selection/:token/respond", rateLimit(60 * 60 * 1000, 20), async (req, res) => {
  const token = cleanString(req.params.token, 200);
  const response = cleanString(req.body?.response, 40).toUpperCase();
  const note = cleanString(req.body?.note, 2000);
  if (!new Set(["CONFIRMED", "DECLINED"]).has(response)) {
    return res.status(400).json({ ok: false, error: "Invalid response" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`
      SELECT s.id, s.application_id, s.status, a.candidate_code, a.pipeline_stage
      FROM media_career_selection_appointments s
      JOIN media_career_applications a ON a.id = s.application_id
      WHERE s.public_token = $1
      FOR UPDATE OF s, a
    `, [token]);
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Selection invitation not found" });
    }
    const row = current.rows[0];
    const responseableStatus = new Set(["INVITED", "CONFIRMED", "DECLINED"]);
    const responseablePipeline = new Set(["SELECTION_INVITED", "SELECTION_CONFIRMED"]);
    if (!responseableStatus.has(row.status) || !responseablePipeline.has(row.pipeline_stage)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "Selection invitation is closed" });
    }

    if (response === "CONFIRMED") {
      await client.query(`
        UPDATE media_career_selection_appointments
        SET status = 'CONFIRMED', candidate_response_note = $1,
            confirmed_at = COALESCE(confirmed_at, NOW()), declined_at = NULL, updated_at = NOW()
        WHERE id = $2
      `, [note, row.id]);
      if (row.pipeline_stage !== "SELECTION_CONFIRMED") {
        await client.query(`
          UPDATE media_career_applications
          SET pipeline_stage = 'SELECTION_CONFIRMED', updated_at = NOW()
          WHERE id = $1
        `, [row.application_id]);
        await client.query(`
          INSERT INTO media_career_stage_history (
            application_id, candidate_code, from_stage, to_stage, changed_by
          ) VALUES ($1,$2,$3,'SELECTION_CONFIRMED','candidate')
        `, [row.application_id, row.candidate_code, row.pipeline_stage]);
      }
    } else {
      await client.query(`
        UPDATE media_career_selection_appointments
        SET status = 'DECLINED', candidate_response_note = $1,
            declined_at = COALESCE(declined_at, NOW()), confirmed_at = NULL, updated_at = NOW()
        WHERE id = $2
      `, [note, row.id]);
    }
    await client.query("COMMIT");
    res.json({ ok: true, status: response });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("selection_response_failed", error);
    res.status(500).json({ ok: false, error: "Unable to save response" });
  } finally {
    client.release();
  }
});

app.get("/v1/admin/legal-readiness/:cohort", requireAdmin, async (req, res) => {
  const cohort = cleanString(req.params.cohort, 20);
  const result = await pool.query(`
    SELECT *
    FROM media_career_legal_readiness
    WHERE cohort = $1
  `, [cohort]);
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Legal readiness record not found" });

  const row = result.rows[0];
  const statusFields = Object.entries(row)
    .filter(([key]) => key.endsWith("_status"))
    .map(([, value]) => value);
  const confirmed = statusFields.filter(value => value === "CONFIRMED" || value === "NOT_APPLICABLE").length;
  res.json({
    ok: true,
    legalReadiness: row,
    progress: {
      completed: confirmed,
      total: statusFields.length,
      percent: statusFields.length ? Math.round((confirmed / statusFields.length) * 1000) / 10 : 0
    },
    admissionSendGate: "BLOCKED_IN_CODE",
    paymentGate: "BLOCKED_IN_CODE"
  });
});

app.patch("/v1/admin/legal-readiness/:cohort", requireAdmin, async (req, res) => {
  const cohort = cleanString(req.params.cohort, 20);
  const b = req.body || {};
  const keys = [
    "operatingEntityStatus", "programClassificationStatus", "activityConditionsStatus",
    "programRegistrationStatus", "curriculumStandardStatus", "certificateWordingStatus",
    "tuitionDisclosureStatus", "enrollmentAgreementStatus", "refundDeferralStatus",
    "invoiceTaxStatus", "productionExposureStatus", "employmentSeparationStatus",
    "privacyTermsStatus"
  ];
  const statuses = keys.map(key => cleanLegalStatus(b[key]));
  if (statuses.some(value => value === null)) {
    return res.status(400).json({ ok: false, error: "Invalid legal checklist status" });
  }
  const counselReference = cleanString(b.counselReference, 2000);
  const authorityReference = cleanString(b.authorityReference, 2000);
  const reviewedBy = cleanString(b.reviewedBy, 240);
  const notes = cleanString(b.notes, 10000);
  const reviewedAt = b.markReviewed === true ? new Date().toISOString() : null;

  const result = await pool.query(`
    INSERT INTO media_career_legal_readiness (
      cohort,
      operating_entity_status, program_classification_status, activity_conditions_status,
      program_registration_status, curriculum_standard_status, certificate_wording_status,
      tuition_disclosure_status, enrollment_agreement_status, refund_deferral_status,
      invoice_tax_status, production_exposure_status, employment_separation_status,
      privacy_terms_status, counsel_reference, authority_reference, reviewed_by,
      reviewed_at, notes, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
      NULLIF($18,'')::timestamptz,$19,NOW()
    )
    ON CONFLICT (cohort)
    DO UPDATE SET
      operating_entity_status = EXCLUDED.operating_entity_status,
      program_classification_status = EXCLUDED.program_classification_status,
      activity_conditions_status = EXCLUDED.activity_conditions_status,
      program_registration_status = EXCLUDED.program_registration_status,
      curriculum_standard_status = EXCLUDED.curriculum_standard_status,
      certificate_wording_status = EXCLUDED.certificate_wording_status,
      tuition_disclosure_status = EXCLUDED.tuition_disclosure_status,
      enrollment_agreement_status = EXCLUDED.enrollment_agreement_status,
      refund_deferral_status = EXCLUDED.refund_deferral_status,
      invoice_tax_status = EXCLUDED.invoice_tax_status,
      production_exposure_status = EXCLUDED.production_exposure_status,
      employment_separation_status = EXCLUDED.employment_separation_status,
      privacy_terms_status = EXCLUDED.privacy_terms_status,
      counsel_reference = EXCLUDED.counsel_reference,
      authority_reference = EXCLUDED.authority_reference,
      reviewed_by = EXCLUDED.reviewed_by,
      reviewed_at = COALESCE(EXCLUDED.reviewed_at, media_career_legal_readiness.reviewed_at),
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
  `, [
    cohort, ...statuses, counselReference, authorityReference, reviewedBy,
    reviewedAt || "", notes
  ]);

  const row = result.rows[0];
  const statusFields = Object.entries(row)
    .filter(([key]) => key.endsWith("_status"))
    .map(([, value]) => value);
  const confirmed = statusFields.filter(value => value === "CONFIRMED" || value === "NOT_APPLICABLE").length;

  res.json({
    ok: true,
    legalReadiness: row,
    progress: {
      completed: confirmed,
      total: statusFields.length,
      percent: statusFields.length ? Math.round((confirmed / statusFields.length) * 1000) / 10 : 0
    },
    admissionSendGate: "BLOCKED_IN_CODE",
    paymentGate: "BLOCKED_IN_CODE"
  });
});

app.patch("/v1/admin/legal-readiness/:cohort/final-approval", requireAdmin, async (req, res) => {
  const cohort = cleanString(req.params.cohort, 20);
  const decision = cleanString(req.body?.decision || "PENDING", 40).toUpperCase();
  const approvedBy = cleanString(req.body?.approvedBy, 240);
  const approvalReference = cleanString(req.body?.approvalReference, 3000);
  if (!new Set(["PENDING", "APPROVED", "REJECTED"]).has(decision)) {
    return res.status(400).json({ ok: false, error: "Invalid final approval decision" });
  }

  const current = await pool.query(`
    SELECT *
    FROM media_career_legal_readiness
    WHERE cohort = $1
  `, [cohort]);
  if (!current.rowCount) {
    return res.status(404).json({ ok: false, error: "Legal readiness record not found" });
  }
  const row = current.rows[0];
  const statusValues = Object.entries(row)
    .filter(([key]) => key.endsWith("_status") && key !== "final_approval_status")
    .map(([, value]) => value);
  const allComplete = statusValues.length > 0 &&
    statusValues.every(value => value === "CONFIRMED" || value === "NOT_APPLICABLE");

  if (decision === "APPROVED") {
    if (!allComplete) {
      return res.status(409).json({ ok: false, error: "All legal checklist items must be completed before final approval" });
    }
    if (!approvedBy) {
      return res.status(400).json({ ok: false, error: "Approved by is required" });
    }
    if (!approvalReference) {
      return res.status(400).json({ ok: false, error: "Final approval reference is required" });
    }
    if (!row.counsel_reference && !row.authority_reference) {
      return res.status(409).json({ ok: false, error: "Counsel or authority reference must be stored before final approval" });
    }
  }

  const result = await pool.query(`
    UPDATE media_career_legal_readiness
    SET final_approval_status = $1,
        final_approval_reference = NULLIF($2,''),
        final_approved_by = NULLIF($3,''),
        final_approved_at = CASE WHEN $1 = 'APPROVED' THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE cohort = $4
    RETURNING *
  `, [decision, approvalReference, approvedBy, cohort]);

  res.json({
    ok: true,
    legalReadiness: result.rows[0],
    finalApproval: decision,
    admissionSendGate: "BLOCKED_IN_CODE",
    paymentGate: "BLOCKED_IN_CODE",
    note: "Final legal approval is evidence for a future reviewed unlock PR; it does not unlock Admission Send or Payment."
  });
});

app.get("/v1/admin/applications", requireAdmin, async (req, res) => {
  const stage = cleanString(req.query.stage, 80);
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  const params = [];
  let where = "";
  if (stage) {
    params.push(stage);
    where = `WHERE pipeline_stage = $${params.length}`;
  }
  params.push(limit);
  const result = await pool.query(`
    SELECT id, candidate_code, cohort, full_name, phone, email, city,
           current_status, preferred_track, experience_level, portfolio_url,
           pipeline_stage, owner, next_action, next_action_date, lost_reason,
           utm_source, utm_medium, utm_campaign, utm_content,
           marketing_consent, submitted_at, updated_at,
           (SELECT total_score FROM media_career_assessments ma WHERE ma.application_id = media_career_applications.id) AS selection_score,
           (SELECT decision FROM media_career_assessments ma WHERE ma.application_id = media_career_applications.id) AS assessment_decision,
           (SELECT status FROM media_career_admissions md WHERE md.application_id = media_career_applications.id) AS admission_status,
           (SELECT status FROM media_career_selection_appointments ms WHERE ms.application_id = media_career_applications.id) AS selection_appointment_status,
           (SELECT selection_start FROM media_career_selection_appointments ms WHERE ms.application_id = media_career_applications.id) AS selection_start
    FROM media_career_applications
    ${where}
    ORDER BY submitted_at DESC
    LIMIT $${params.length}
  `, params);
  res.json({ ok: true, applications: result.rows });
});

app.get("/v1/admin/applications/:id", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT id, candidate_code, cohort, full_name, date_of_birth, phone, email, city,
           current_status, preferred_track, experience_level, portfolio_url,
           pipeline_stage, owner, next_action, next_action_date, lost_reason, internal_notes,
           utm_source, utm_medium, utm_campaign, utm_content,
           marketing_consent, privacy_consent, payload, submitted_at, updated_at
    FROM media_career_applications
    WHERE id = $1
  `, [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Not found" });
  const [history, assessment, admission, selection] = await Promise.all([
    pool.query(`
      SELECT from_stage, to_stage, changed_by, changed_at
      FROM media_career_stage_history
      WHERE application_id = $1
      ORDER BY changed_at DESC
      LIMIT 100
    `, [req.params.id]),
    pool.query(`
      SELECT visual_score, learning_score, execution_score, behaviour_score,
             motivation_score, total_score, assessor, selection_notes,
             interview_notes, decision, updated_at
      FROM media_career_assessments
      WHERE application_id = $1
    `, [req.params.id]),
    pool.query(`
      SELECT status, program_name, cohort, tuition_amount, payment_plan,
             proposed_start_date, response_deadline, schedule_note,
             admission_note, prepared_by, updated_at
      FROM media_career_admissions
      WHERE application_id = $1
    `, [req.params.id]),
    pool.query(`
      SELECT public_token, selection_start, duration_minutes, timezone, mode,
             location, status, invitation_note, prep_note, candidate_response_note,
             confirmed_at, declined_at, attended_at, updated_at
      FROM media_career_selection_appointments
      WHERE application_id = $1
    `, [req.params.id])
  ]);
  res.json({
    ok: true,
    application: result.rows[0],
    history: history.rows,
    assessment: assessment.rows[0] || null,
    admission: admission.rows[0] || null,
    selection: selection.rows[0] || null,
    admissionLegalGate: "BLOCKED"
  });
});

app.patch("/v1/admin/applications/:id/selection", requireAdmin, async (req, res) => {
  const application = await pool.query(
    "SELECT id, candidate_code, pipeline_stage FROM media_career_applications WHERE id = $1",
    [req.params.id]
  );
  if (!application.rowCount) return res.status(404).json({ ok: false, error: "Not found" });
  const allowedPipeline = new Set(["QUALIFIED", "SELECTION_INVITED", "SELECTION_CONFIRMED"]);
  if (!allowedPipeline.has(application.rows[0].pipeline_stage)) {
    return res.status(409).json({
      ok: false,
      error: "Selection scheduling is available only for Qualified/Selection candidates"
    });
  }

  const b = req.body || {};
  const selectionStart = cleanString(b.selectionStart, 60);
  const durationMinutes = Number(b.durationMinutes || 90);
  const mode = cleanString(b.mode || "ONSITE", 40).toUpperCase();
  const location = cleanString(b.location, 1000);
  const invitationNote = cleanString(b.invitationNote, 4000);
  const prepNote = cleanString(b.prepNote, 4000);
  if (selectionStart && Number.isNaN(Date.parse(selectionStart))) {
    return res.status(400).json({ ok: false, error: "Invalid selection start" });
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    return res.status(400).json({ ok: false, error: "Invalid duration" });
  }
  if (!new Set(["ONSITE", "ONLINE"]).has(mode)) {
    return res.status(400).json({ ok: false, error: "Invalid selection mode" });
  }

  const token = selectionToken();
  const result = await pool.query(`
    INSERT INTO media_career_selection_appointments (
      application_id, public_token, selection_start, duration_minutes,
      timezone, mode, location, status, invitation_note, prep_note, updated_at
    ) VALUES ($1,$2,NULLIF($3,'')::timestamptz,$4,'Asia/Ho_Chi_Minh',$5,$6,'DRAFT',$7,$8,NOW())
    ON CONFLICT (application_id)
    DO UPDATE SET
      selection_start = EXCLUDED.selection_start,
      duration_minutes = EXCLUDED.duration_minutes,
      mode = EXCLUDED.mode,
      location = EXCLUDED.location,
      invitation_note = EXCLUDED.invitation_note,
      prep_note = EXCLUDED.prep_note,
      updated_at = NOW()
    RETURNING public_token, selection_start, duration_minutes, timezone, mode,
              location, status, invitation_note, prep_note, candidate_response_note,
              confirmed_at, declined_at, attended_at, updated_at
  `, [
    req.params.id, token, selectionStart, durationMinutes, mode,
    location, invitationNote, prepNote
  ]);
  res.json({ ok: true, selection: result.rows[0] });
});

app.post("/v1/admin/applications/:id/selection/mark-invited", requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`
      SELECT a.id, a.candidate_code, a.pipeline_stage,
             s.id AS selection_id, s.selection_start, s.mode, s.location
      FROM media_career_applications a
      JOIN media_career_selection_appointments s ON s.application_id = a.id
      WHERE a.id = $1
      FOR UPDATE OF a, s
    `, [req.params.id]);
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Selection draft not found" });
    }
    const row = current.rows[0];
    if (!new Set(["QUALIFIED", "SELECTION_INVITED", "SELECTION_CONFIRMED"]).has(row.pipeline_stage)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "Candidate is no longer in Selection scheduling" });
    }
    if (!row.selection_start) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "Selection date/time is required" });
    }
    if (!row.location) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "Location or meeting link is required" });
    }
    await client.query(
      "UPDATE media_career_selection_appointments SET status = 'INVITED', updated_at = NOW() WHERE id = $1",
      [row.selection_id]
    );
    if (row.pipeline_stage !== "SELECTION_INVITED") {
      await client.query(
        "UPDATE media_career_applications SET pipeline_stage = 'SELECTION_INVITED', updated_at = NOW() WHERE id = $1",
        [row.id]
      );
      await client.query(`
        INSERT INTO media_career_stage_history (
          application_id, candidate_code, from_stage, to_stage, changed_by
        ) VALUES ($1,$2,$3,'SELECTION_INVITED','admin')
      `, [row.id, row.candidate_code, row.pipeline_stage]);
    }
    await client.query("COMMIT");
    res.json({ ok: true, status: "INVITED" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("selection_invite_mark_failed", error);
    res.status(500).json({ ok: false, error: "Unable to mark invitation" });
  } finally {
    client.release();
  }
});

app.post("/v1/admin/applications/:id/selection/attended", requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`
      SELECT a.id, a.candidate_code, a.pipeline_stage, s.id AS selection_id
      FROM media_career_applications a
      JOIN media_career_selection_appointments s ON s.application_id = a.id
      WHERE a.id = $1
      FOR UPDATE OF a, s
    `, [req.params.id]);
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Selection appointment not found" });
    }
    const row = current.rows[0];
    if (!new Set(["SELECTION_INVITED", "SELECTION_CONFIRMED"]).has(row.pipeline_stage)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "Candidate is no longer awaiting Selection attendance" });
    }
    await client.query(
      "UPDATE media_career_selection_appointments SET status = 'ATTENDED', attended_at = COALESCE(attended_at, NOW()), updated_at = NOW() WHERE id = $1",
      [row.selection_id]
    );
    if (row.pipeline_stage !== "SELECTION_ATTENDED") {
      await client.query(
        "UPDATE media_career_applications SET pipeline_stage = 'SELECTION_ATTENDED', updated_at = NOW() WHERE id = $1",
        [row.id]
      );
      await client.query(`
        INSERT INTO media_career_stage_history (
          application_id, candidate_code, from_stage, to_stage, changed_by
        ) VALUES ($1,$2,$3,'SELECTION_ATTENDED','admin')
      `, [row.id, row.candidate_code, row.pipeline_stage]);
    }
    await client.query("COMMIT");
    res.json({ ok: true, status: "ATTENDED" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("selection_attended_failed", error);
    res.status(500).json({ ok: false, error: "Unable to mark attended" });
  } finally {
    client.release();
  }
});

app.patch("/v1/admin/applications/:id/assessment", requireAdmin, async (req, res) => {
  const b = req.body || {};
  const visual = cleanScore(b.visualScore, 25);
  const learning = cleanScore(b.learningScore, 20);
  const execution = cleanScore(b.executionScore, 20);
  const behaviour = cleanScore(b.behaviourScore, 20);
  const motivation = cleanScore(b.motivationScore, 15);
  const decision = cleanString(b.decision || "PENDING", 40).toUpperCase();
  const allowedDecision = new Set(["PENDING", "PASS", "WAITLIST", "LOST"]);
  if ([visual, learning, execution, behaviour, motivation].some(v => v === null)) {
    return res.status(400).json({ ok: false, error: "Invalid assessment score" });
  }
  if (!allowedDecision.has(decision)) {
    return res.status(400).json({ ok: false, error: "Invalid assessment decision" });
  }
  const total = Math.round((visual + learning + execution + behaviour + motivation) * 100) / 100;
  const assessor = cleanString(b.assessor, 160);
  const selectionNotes = cleanString(b.selectionNotes, 6000);
  const interviewNotes = cleanString(b.interviewNotes, 6000);
  const targetStage = decision === "PASS" ? "PASS"
    : decision === "WAITLIST" ? "WAITLIST"
    : decision === "LOST" ? "LOST"
    : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const appRow = await client.query(
      "SELECT id, candidate_code, pipeline_stage FROM media_career_applications WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!appRow.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Not found" });
    }
    const appData = appRow.rows[0];
    const saved = await client.query(`
      INSERT INTO media_career_assessments (
        application_id, visual_score, learning_score, execution_score,
        behaviour_score, motivation_score, total_score, assessor,
        selection_notes, interview_notes, decision, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (application_id)
      DO UPDATE SET
        visual_score = EXCLUDED.visual_score,
        learning_score = EXCLUDED.learning_score,
        execution_score = EXCLUDED.execution_score,
        behaviour_score = EXCLUDED.behaviour_score,
        motivation_score = EXCLUDED.motivation_score,
        total_score = EXCLUDED.total_score,
        assessor = EXCLUDED.assessor,
        selection_notes = EXCLUDED.selection_notes,
        interview_notes = EXCLUDED.interview_notes,
        decision = EXCLUDED.decision,
        updated_at = NOW()
      RETURNING visual_score, learning_score, execution_score, behaviour_score,
                motivation_score, total_score, assessor, selection_notes,
                interview_notes, decision, updated_at
    `, [
      req.params.id, visual, learning, execution, behaviour, motivation, total,
      assessor, selectionNotes, interviewNotes, decision
    ]);

    let pipelineStage = appData.pipeline_stage;
    if (targetStage && targetStage !== appData.pipeline_stage) {
      const updated = await client.query(`
        UPDATE media_career_applications
        SET pipeline_stage = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING pipeline_stage
      `, [targetStage, req.params.id]);
      pipelineStage = updated.rows[0].pipeline_stage;
      await client.query(`
        INSERT INTO media_career_stage_history (
          application_id, candidate_code, from_stage, to_stage, changed_by
        ) VALUES ($1,$2,$3,$4,'assessment')
      `, [appData.id, appData.candidate_code, appData.pipeline_stage, targetStage]);
    }
    await client.query("COMMIT");
    res.json({ ok: true, assessment: saved.rows[0], pipelineStage });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("assessment_update_failed", error);
    res.status(500).json({ ok: false, error: "Unable to save assessment" });
  } finally {
    client.release();
  }
});

app.patch("/v1/admin/applications/:id/admission-draft", requireAdmin, async (req, res) => {
  const application = await pool.query(
    "SELECT id, candidate_code, full_name, pipeline_stage FROM media_career_applications WHERE id = $1",
    [req.params.id]
  );
  if (!application.rowCount) return res.status(404).json({ ok: false, error: "Not found" });
  const appData = application.rows[0];
  if (appData.pipeline_stage !== "PASS") {
    return res.status(409).json({
      ok: false,
      error: "Admission draft is available only after PASS decision"
    });
  }

  const b = req.body || {};
  const status = cleanString(b.status || "DRAFT", 40).toUpperCase();
  if (!new Set(["DRAFT", "READY_FOR_LEGAL"]).has(status)) {
    return res.status(400).json({ ok: false, error: "Invalid admission draft status" });
  }
  const programName = cleanString(b.programName || "Hang Đôi Media Career Program", 240);
  const paymentPlan = cleanString(
    b.paymentPlan || "40.000.000 VNĐ một lần hoặc 10.000.000 VNĐ × 4 kỳ",
    1000
  );
  const proposedStartDate = cleanString(b.proposedStartDate, 20);
  const responseDeadline = cleanString(b.responseDeadline, 20);
  const scheduleNote = cleanString(b.scheduleNote, 3000);
  const admissionNote = cleanString(b.admissionNote, 6000);
  const preparedBy = cleanString(b.preparedBy, 160);
  const tuitionAmount = Number(b.tuitionAmount || 40000000);
  if (!Number.isInteger(tuitionAmount) || tuitionAmount < 0 || tuitionAmount > 1000000000) {
    return res.status(400).json({ ok: false, error: "Invalid tuition amount" });
  }

  const result = await pool.query(`
    INSERT INTO media_career_admissions (
      application_id, status, program_name, cohort, tuition_amount, payment_plan,
      proposed_start_date, response_deadline, schedule_note, admission_note,
      prepared_by, updated_at
    ) VALUES (
      $1,$2,$3,'01',$4,$5,NULLIF($6,'')::date,NULLIF($7,'')::date,$8,$9,$10,NOW()
    )
    ON CONFLICT (application_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      program_name = EXCLUDED.program_name,
      tuition_amount = EXCLUDED.tuition_amount,
      payment_plan = EXCLUDED.payment_plan,
      proposed_start_date = EXCLUDED.proposed_start_date,
      response_deadline = EXCLUDED.response_deadline,
      schedule_note = EXCLUDED.schedule_note,
      admission_note = EXCLUDED.admission_note,
      prepared_by = EXCLUDED.prepared_by,
      updated_at = NOW()
    RETURNING status, program_name, cohort, tuition_amount, payment_plan,
              proposed_start_date, response_deadline, schedule_note,
              admission_note, prepared_by, updated_at
  `, [
    req.params.id, status, programName, tuitionAmount, paymentPlan,
    proposedStartDate, responseDeadline, scheduleNote, admissionNote, preparedBy
  ]);

  res.json({
    ok: true,
    admission: result.rows[0],
    legalGate: "BLOCKED",
    sendEnabled: false,
    paymentEnabled: false
  });
});

app.patch("/v1/admin/applications/:id/ops", requireAdmin, async (req, res) => {
  const b = req.body || {};
  const owner = cleanString(b.owner, 160);
  const nextAction = cleanString(b.nextAction, 1000);
  const nextActionDate = cleanString(b.nextActionDate, 20);
  const lostReason = cleanString(b.lostReason, 160);
  const internalNotes = cleanString(b.internalNotes, 6000);
  const result = await pool.query(`
    UPDATE media_career_applications
    SET owner = NULLIF($1,''),
        next_action = NULLIF($2,''),
        next_action_date = NULLIF($3,'')::date,
        lost_reason = NULLIF($4,''),
        internal_notes = NULLIF($5,''),
        updated_at = NOW()
    WHERE id = $6
    RETURNING id, candidate_code, owner, next_action, next_action_date,
              lost_reason, internal_notes, updated_at
  `, [owner, nextAction, nextActionDate, lostReason, internalNotes, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, application: result.rows[0] });
});

app.post("/v1/admin/applications/:id/admission-send", requireAdmin, async (_req, res) => {
  res.status(423).json({
    ok: false,
    error: "Admission sending is blocked until Legal & Enrollment gate is approved"
  });
});

app.get("/v1/admin/dashboard", requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 30), 1), 365);
  const [stageRows, sourceRows, contentRows, eventRows, totals, cohortConfig, cohortCounts, legalReadiness] = await Promise.all([
    pool.query(`
      SELECT pipeline_stage AS key, COUNT(*)::int AS count
      FROM media_career_applications
      WHERE submitted_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY pipeline_stage ORDER BY count DESC
    `, [days]),
    pool.query(`
      SELECT COALESCE(NULLIF(utm_source,''),'direct') AS key, COUNT(*)::int AS count
      FROM media_career_applications
      WHERE submitted_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY 1 ORDER BY count DESC
    `, [days]),
    pool.query(`
      SELECT COALESCE(NULLIF(utm_content,''),'unattributed') AS key, COUNT(*)::int AS count
      FROM media_career_applications
      WHERE submitted_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY 1 ORDER BY count DESC LIMIT 30
    `, [days]),
    pool.query(`
      SELECT event_name AS key, COUNT(*)::int AS count
      FROM media_career_events
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY event_name ORDER BY count DESC
    `, [days]),
    pool.query(`
      SELECT
        COUNT(*)::int AS applications,
        COUNT(*) FILTER (WHERE pipeline_stage IN (
          'QUALIFIED','SELECTION_INVITED','SELECTION_CONFIRMED',
          'SELECTION_ATTENDED','PASS','WAITLIST','ADMITTED','ENROLLED'
        ))::int AS qualified_or_beyond,
        COUNT(*) FILTER (WHERE pipeline_stage IN (
          'SELECTION_INVITED','SELECTION_CONFIRMED','SELECTION_ATTENDED'
        ))::int AS in_selection,
        COUNT(*) FILTER (WHERE pipeline_stage IN ('PASS','ADMITTED','ENROLLED'))::int AS passed_or_beyond,
        COUNT(*) FILTER (WHERE pipeline_stage IN ('ADMITTED','ENROLLED'))::int AS admitted_or_enrolled
      FROM media_career_applications
      WHERE submitted_at >= NOW() - ($1::text || ' days')::interval
    `, [days]),
    pool.query(`
      SELECT cohort, target_enrollment, status
      FROM media_career_cohorts
      WHERE cohort = '01'
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE pipeline_stage = 'PASS')::int AS pass,
        COUNT(*) FILTER (WHERE pipeline_stage = 'WAITLIST')::int AS waitlist,
        COUNT(*) FILTER (WHERE pipeline_stage = 'ADMITTED')::int AS admitted,
        COUNT(*) FILTER (WHERE pipeline_stage = 'ENROLLED')::int AS enrolled
      FROM media_career_applications
      WHERE cohort = '01'
    `),
    pool.query(`
      SELECT *
      FROM media_career_legal_readiness
      WHERE cohort = '01'
    `)
  ]);
  const config = cohortConfig.rows[0] || { cohort: "01", target_enrollment: 10, status: "OPEN" };
  const counts = cohortCounts.rows[0] || { pass: 0, waitlist: 0, admitted: 0, enrolled: 0 };
  const target = Number(config.target_enrollment || 10);
  const enrolled = Number(counts.enrolled || 0);
  const coverage = Number(counts.pass || 0) + Number(counts.waitlist || 0) +
    Number(counts.admitted || 0) + enrolled;

  res.json({
    ok: true,
    days,
    totals: totals.rows[0],
    stages: stageRows.rows,
    sources: sourceRows.rows,
    contents: contentRows.rows,
    events: eventRows.rows,
    cohort: {
      cohort: config.cohort,
      status: config.status,
      targetEnrollment: target,
      pass: Number(counts.pass || 0),
      waitlist: Number(counts.waitlist || 0),
      admitted: Number(counts.admitted || 0),
      enrolled,
      coverage,
      remainingToEnroll: Math.max(target - enrolled, 0),
      coverageGap: Math.max(target - coverage, 0),
      enrolledPct: target ? Math.round((enrolled / target) * 1000) / 10 : 0,
      coveragePct: target ? Math.round((coverage / target) * 1000) / 10 : 0
    },
    legalReadiness: legalReadiness.rows[0] || null,
    admissionSendGate: "BLOCKED_IN_CODE",
    paymentGate: "BLOCKED_IN_CODE"
  });
});

app.patch("/v1/admin/cohort/:cohort", requireAdmin, async (req, res) => {
  const cohort = cleanString(req.params.cohort, 20);
  const targetEnrollment = Number(req.body?.targetEnrollment);
  const status = cleanString(req.body?.status || "OPEN", 40).toUpperCase();
  if (!Number.isInteger(targetEnrollment) || targetEnrollment < 1 || targetEnrollment > 100) {
    return res.status(400).json({ ok: false, error: "Invalid target enrollment" });
  }
  if (!new Set(["OPEN", "PAUSED", "CLOSED"]).has(status)) {
    return res.status(400).json({ ok: false, error: "Invalid cohort status" });
  }
  const result = await pool.query(`
    INSERT INTO media_career_cohorts (cohort, target_enrollment, status, updated_at)
    VALUES ($1,$2,$3,NOW())
    ON CONFLICT (cohort)
    DO UPDATE SET target_enrollment = EXCLUDED.target_enrollment,
                  status = EXCLUDED.status,
                  updated_at = NOW()
    RETURNING cohort, target_enrollment, status, updated_at
  `, [cohort, targetEnrollment, status]);
  res.json({ ok: true, cohort: result.rows[0] });
});

app.get("/v1/admin/notifications", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT id, candidate_code, notification_type, payload, status, created_at, read_at
    FROM media_career_notifications
    ORDER BY created_at DESC
    LIMIT 100
  `);
  res.json({ ok: true, notifications: result.rows });
});

app.patch("/v1/admin/notifications/:id/read", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    UPDATE media_career_notifications
    SET status = 'READ', read_at = NOW()
    WHERE id = $1
    RETURNING id, status, read_at
  `, [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, notification: result.rows[0] });
});

app.patch("/v1/admin/applications/:id/stage", requireAdmin, async (req, res) => {
  const allowed = new Set([
    "APPLICATION_COMPLETED", "QUALIFIED", "SELECTION_INVITED", "SELECTION_CONFIRMED",
    "SELECTION_ATTENDED", "PASS", "WAITLIST", "LOST", "ADMITTED", "ENROLLED"
  ]);
  const stage = cleanString(req.body?.stage, 80);
  if (!allowed.has(stage)) {
    return res.status(400).json({ ok: false, error: "Invalid stage" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query(
      "SELECT id, candidate_code, pipeline_stage FROM media_career_applications WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!previous.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Not found" });
    }
    const prev = previous.rows[0];
    const result = await client.query(`
      UPDATE media_career_applications
      SET pipeline_stage = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, candidate_code, pipeline_stage, updated_at
    `, [stage, req.params.id]);
    if (prev.pipeline_stage !== stage) {
      await client.query(`
        INSERT INTO media_career_stage_history (
          application_id, candidate_code, from_stage, to_stage, changed_by
        ) VALUES ($1,$2,$3,$4,'admin')
      `, [prev.id, prev.candidate_code, prev.pipeline_stage, stage]);
    }
    await client.query("COMMIT");
    res.json({ ok: true, application: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("stage_update_failed", error);
    res.status(500).json({ ok: false, error: "Unable to update stage" });
  } finally {
    client.release();
  }
});

initDb()
  .then(() => app.listen(port, "0.0.0.0", () => {
    console.log(`candidate-api listening on ${port}`);
  }))
  .catch((error) => {
    console.error("db_init_failed", error);
    process.exit(1);
  });
