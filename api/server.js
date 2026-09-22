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

function candidateCode(cohort = "01") {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `MCP${cohort}-${stamp}-${rand}`;
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
           (SELECT status FROM media_career_admissions md WHERE md.application_id = media_career_applications.id) AS admission_status
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
  const [history, assessment, admission] = await Promise.all([
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
    `, [req.params.id])
  ]);
  res.json({
    ok: true,
    application: result.rows[0],
    history: history.rows,
    assessment: assessment.rows[0] || null,
    admission: admission.rows[0] || null,
    admissionLegalGate: "BLOCKED"
  });
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
  const [stageRows, sourceRows, contentRows, eventRows, totals] = await Promise.all([
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
    `, [days])
  ]);
  res.json({
    ok: true,
    days,
    totals: totals.rows[0],
    stages: stageRows.rows,
    sources: sourceRows.rows,
    contents: contentRows.rows,
    events: eventRows.rows
  });
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
