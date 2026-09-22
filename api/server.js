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
  `);
}

function cleanString(value, max = 5000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanString(value, 320).toLowerCase();
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

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "hangdoi-academy-candidate-api" });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.post("/v1/applications", async (req, res) => {
  try {
    const b = req.body || {};
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

    res.status(201).json({
      ok: true,
      candidateCode: result.rows[0].candidate_code,
      submittedAt: result.rows[0].submitted_at
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
           pipeline_stage, utm_source, utm_medium, utm_campaign, utm_content,
           marketing_consent, submitted_at, updated_at
    FROM media_career_applications
    ${where}
    ORDER BY submitted_at DESC
    LIMIT $${params.length}
  `, params);
  res.json({ ok: true, applications: result.rows });
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
  const result = await pool.query(`
    UPDATE media_career_applications
    SET pipeline_stage = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, candidate_code, pipeline_stage, updated_at
  `, [stage, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, application: result.rows[0] });
});

initDb()
  .then(() => app.listen(port, "0.0.0.0", () => {
    console.log(`candidate-api listening on ${port}`);
  }))
  .catch((error) => {
    console.error("db_init_failed", error);
    process.exit(1);
  });
