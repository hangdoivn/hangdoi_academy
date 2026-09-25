import express from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "node:crypto";
import { createMySqlPool, initMySqlSchema } from "./db-mysql.js";
import { getMysqlBackupStatus, startMysqlBackupScheduler } from "./backup-mysql.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const pool = createMySqlPool(process.env.MYSQL_URL);

const allowedOrigins = new Set([
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
  await initMySqlSchema(pool);
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

const OUTBOUND_DELIVERY_INTERVAL_MS = 30 * 1000;
const OUTBOUND_DELIVERY_BATCH_SIZE = 10;
const outboundEndpointKeys = new Set([
  "NEW_APPLICATION_WEBHOOK_URL",
  "APPLICATION_ACK_WEBHOOK_URL"
]);
let outboundWorkerRunning = false;

function outboundEndpoint(endpointKey) {
  if (!outboundEndpointKeys.has(endpointKey)) return "";
  return String(process.env[endpointKey] || "").trim();
}

const outboundFormats = new Set(["generic", "google_chat", "slack"]);
function outboundFormat(endpointKey) {
  const formatKey = endpointKey === "NEW_APPLICATION_WEBHOOK_URL"
    ? "NEW_APPLICATION_WEBHOOK_FORMAT"
    : "APPLICATION_ACK_WEBHOOK_FORMAT";
  const format = String(process.env[formatKey] || "generic").trim().toLowerCase();
  return outboundFormats.has(format) ? format : "generic";
}

function outboundText(payload = {}) {
  if (payload.type === "NEW_APPLICATION") {
    return [
      "📥 Hang Đôi Academy · Đăng ký quan tâm mới",
      payload.fullName ? `Ứng viên: ${payload.fullName}` : "",
      payload.candidateCode ? `Candidate ID: ${payload.candidateCode}` : "",
      payload.email ? `Email: ${payload.email}` : "",
      payload.phone ? `Điện thoại: ${payload.phone}` : "",
      payload.preferredTrack ? `Hướng quan tâm: ${payload.preferredTrack}` : "",
      payload.source ? `Nguồn: ${payload.source}${payload.content ? ` / ${payload.content}` : ""}` : "",
      payload.submittedAt ? `Thời gian: ${new Date(payload.submittedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""
    ].filter(Boolean).join("\n");
  }
  if (payload.type === "APPLICATION_ACK") {
    return [
      "✅ Hang Đôi Academy · Đã ghi nhận đăng ký",
      payload.fullName ? `Ứng viên: ${payload.fullName}` : "",
      payload.candidateCode ? `Candidate ID: ${payload.candidateCode}` : "",
      payload.email ? `Email: ${payload.email}` : "",
      payload.submittedAt ? `Thời gian: ${new Date(payload.submittedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""
    ].filter(Boolean).join("\n");
  }
  if (payload.type === "ACADEMY_OUTBOUND_TEST") {
    return [
      "🧪 Hang Đôi Academy · Outbound test",
      payload.endpointKey ? `Endpoint: ${payload.endpointKey}` : "",
      payload.testCode ? `Test ID: ${payload.testCode}` : "",
      "Nếu bạn thấy tin này thì kết nối outbound đang hoạt động."
    ].filter(Boolean).join("\n");
  }
  return JSON.stringify(payload);
}

function formatOutboundPayload(endpointKey, payload) {
  const format = outboundFormat(endpointKey);
  if (format === "google_chat" || format === "slack") {
    return { text: outboundText(payload) };
  }
  return payload;
}

function outboundBackoffSeconds(attempt) {
  const schedule = [30, 120, 600, 1800, 7200, 21600];
  const index = Math.min(Math.max(Number(attempt || 1) - 1, 0), schedule.length - 1);
  return schedule[index];
}

async function sendWebhookRequest(url, payload, deliveryId, endpointKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `academy-outbound-${deliveryId}`,
        "X-Hangdoi-Delivery-Id": String(deliveryId)
      },
      body: JSON.stringify(formatOutboundPayload(endpointKey, payload)),
      signal: controller.signal
    });
    return {
      ok: response.ok,
      statusCode: response.status,
      error: response.ok ? "" : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      error: error?.name === "AbortError"
        ? "timeout"
        : cleanString(error?.message || "network_error", 1000)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function configuredOutboundJobs(webhookPayload, acknowledgementPayload) {
  const jobs = [];
  if (outboundEndpoint("NEW_APPLICATION_WEBHOOK_URL")) {
    jobs.push({
      deliveryType: "NEW_APPLICATION_WEBHOOK",
      endpointKey: "NEW_APPLICATION_WEBHOOK_URL",
      payload: webhookPayload
    });
  }
  if (outboundEndpoint("APPLICATION_ACK_WEBHOOK_URL")) {
    jobs.push({
      deliveryType: "APPLICATION_ACK_WEBHOOK",
      endpointKey: "APPLICATION_ACK_WEBHOOK_URL",
      payload: acknowledgementPayload
    });
  }
  return jobs;
}

async function enqueueOutboundJobs(client, candidateCodeValue, jobs) {
  for (const job of jobs) {
    await client.query(`
      INSERT INTO media_career_outbound_deliveries (
        candidate_code, delivery_type, endpoint_key, payload,
        status, attempt_count, max_attempts, next_attempt_at
      ) VALUES (
        $1,$2,$3,$4::jsonb,'PENDING',0,6,NOW()
      )
      ON CONFLICT (candidate_code, delivery_type)
      DO NOTHING
    `, [
      candidateCodeValue,
      job.deliveryType,
      job.endpointKey,
      JSON.stringify(job.payload || {})
    ]);
  }
}

async function processOutboundDeliveries() {
  if (outboundWorkerRunning) return;
  outboundWorkerRunning = true;
  try {
    await pool.query(`
      UPDATE media_career_outbound_deliveries
      SET status = 'RETRY',
          next_attempt_at = NOW(),
          last_error = 'worker lease expired',
          updated_at = NOW()
      WHERE status = 'PROCESSING'
        AND delivered_at IS NULL
        AND last_attempt_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    `);

    const due = await pool.query(`
      SELECT id, candidate_code, delivery_type, endpoint_key, payload,
             attempt_count, max_attempts
      FROM media_career_outbound_deliveries
      WHERE status IN ('PENDING','RETRY')
        AND next_attempt_at <= NOW()
      ORDER BY next_attempt_at ASC, id ASC
      LIMIT ${OUTBOUND_DELIVERY_BATCH_SIZE}
    `);

    for (const row of due.rows) {
      const claim = await pool.query(`
        UPDATE media_career_outbound_deliveries
        SET status = 'PROCESSING',
            attempt_count = attempt_count + 1,
            last_attempt_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND status IN ('PENDING','RETRY')
          AND next_attempt_at <= NOW()
      `, [row.id]);
      if (claim.rowCount !== 1) continue;

      const attempt = Number(row.attempt_count || 0) + 1;
      const maxAttempts = Number(row.max_attempts || 6);
      const endpoint = outboundEndpoint(row.endpoint_key);
      const result = endpoint
        ? await sendWebhookRequest(endpoint, row.payload || {}, row.id, row.endpoint_key)
        : { ok: false, statusCode: null, error: "endpoint_not_configured" };

      if (result.ok) {
        await pool.query(`
          UPDATE media_career_outbound_deliveries
          SET status = 'DELIVERED',
              delivered_at = NOW(),
              next_attempt_at = NOW(),
              last_status_code = $1,
              last_error = NULL,
              updated_at = NOW()
          WHERE id = $2
        `, [result.statusCode, row.id]);
        continue;
      }

      if (attempt >= maxAttempts) {
        await pool.query(`
          UPDATE media_career_outbound_deliveries
          SET status = 'FAILED',
              last_status_code = $1,
              last_error = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [result.statusCode, cleanString(result.error, 1000), row.id]);
        console.error("outbound_delivery_failed", {
          id: row.id,
          deliveryType: row.delivery_type,
          attempt
        });
        continue;
      }

      const retrySeconds = outboundBackoffSeconds(attempt);
      const nextAttemptAt = new Date(Date.now() + retrySeconds * 1000);
      await pool.query(`
        UPDATE media_career_outbound_deliveries
        SET status = 'RETRY',
            next_attempt_at = $1,
            last_status_code = $2,
            last_error = $3,
            updated_at = NOW()
        WHERE id = $4
      `, [
        nextAttemptAt,
        result.statusCode,
        cleanString(result.error, 1000),
        row.id
      ]);
    }
  } catch (error) {
    console.error("outbound_worker_failed", error?.message || error);
  } finally {
    outboundWorkerRunning = false;
  }
}

function startOutboundDeliveryWorker() {
  const startup = setTimeout(() => void processOutboundDeliveries(), 1000);
  startup.unref();
  const interval = setInterval(() => void processOutboundDeliveries(), OUTBOUND_DELIVERY_INTERVAL_MS);
  interval.unref();
  console.log("[outbound-delivery] worker_started", {
    intervalMs: OUTBOUND_DELIVERY_INTERVAL_MS,
    batchSize: OUTBOUND_DELIVERY_BATCH_SIZE,
    configured: Array.from(outboundEndpointKeys).filter((key) => Boolean(outboundEndpoint(key))),
    formats: Object.fromEntries(Array.from(outboundEndpointKeys).map((key) => [key, outboundFormat(key)]))
  });
}

async function recordEvent(event) {
  const allowed = new Set([
    "landing_view", "apply_view", "form_start", "form_submit_client",
    "form_submit_error", "application_received", "application_retry_received",
    "thank_you_view"
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

app.get("/health/backup", async (_req, res) => {
  const status = await getMysqlBackupStatus({ maxAgeHours: 30 });
  res.status(status.ok ? 200 : 503).json(status);
});

app.get("/health/intake", async (_req, res) => {
  try {
    await pool.query(`
      SELECT candidate_code, email_normalized, privacy_consent, pipeline_stage, payload
      FROM media_career_applications
      LIMIT 1
    `);
    await pool.query(`
      SELECT event_name, session_id, candidate_code, metadata
      FROM media_career_events
      LIMIT 1
    `);
    await pool.query(`
      SELECT candidate_code, status, payload
      FROM media_career_notifications
      LIMIT 1
    `);
    await pool.query(`
      SELECT candidate_code, delivery_type, endpoint_key, status, attempt_count, next_attempt_at
      FROM media_career_outbound_deliveries
      LIMIT 1
    `);
    await pool.query("SELECT cohort, target_enrollment, status FROM media_career_cohorts WHERE cohort = $1 LIMIT 1", ["01"]);
    await pool.query("SELECT cohort, program_registration_status FROM media_career_legal_readiness WHERE cohort = $1 LIMIT 1", ["01"]);

    res.json({
      ok: true,
      service: "hangdoi-academy-candidate-api",
      check: "intake-readiness"
    });
  } catch (error) {
    console.error("intake_health_failed", error?.message || error);
    res.status(503).json({
      ok: false,
      service: "hangdoi-academy-candidate-api",
      check: "intake-readiness"
    });
  }
});


app.post("/health/intake/write", rateLimit(10 * 60 * 1000, 3), async (_req, res) => {
  const probeCode = `MCP-HC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const probeEmail = `${probeCode.toLowerCase()}@health.invalid`;
  const probePayload = JSON.stringify({
    synthetic: true,
    check: "intake-write-readiness"
  });
  const startedAt = Date.now();
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    await client.query(`
      INSERT INTO media_career_applications (
        candidate_code, cohort, full_name, phone, email, email_normalized,
        city, current_status, experience_level, pipeline_stage,
        marketing_consent, privacy_consent, payload
      ) VALUES (
        $1, '01', 'Academy Health Probe', '0000000000', $2, $2,
        'Synthetic', 'HEALTHCHECK', 'HEALTHCHECK', 'INTEREST_REGISTERED',
        FALSE, TRUE, $3::jsonb
      )
    `, [probeCode, probeEmail, probePayload]);

    await client.query(`
      INSERT INTO media_career_events (
        event_name, session_id, candidate_code, path, metadata
      ) VALUES (
        'health_write_probe', $1, $1, '/health/intake/write', $2::jsonb
      )
    `, [probeCode, probePayload]);

    await client.query(`
      INSERT INTO media_career_notifications (
        candidate_code, notification_type, payload
      ) VALUES (
        $1, 'HEALTH_WRITE_PROBE', $2::jsonb
      )
    `, [probeCode, probePayload]);

    await client.query(`
      INSERT INTO media_career_outbound_deliveries (
        candidate_code, delivery_type, endpoint_key, payload,
        status, attempt_count, max_attempts, next_attempt_at
      ) VALUES (
        $1, 'HEALTH_WRITE_PROBE', 'NEW_APPLICATION_WEBHOOK_URL', $2::jsonb,
        'PENDING', 0, 1, NOW()
      )
    `, [probeCode, probePayload]);

    const candidateInside = await client.query(
      "SELECT candidate_code FROM media_career_applications WHERE candidate_code = $1",
      [probeCode]
    );
    const eventInside = await client.query(
      "SELECT candidate_code FROM media_career_events WHERE candidate_code = $1 AND event_name = 'health_write_probe'",
      [probeCode]
    );
    const notificationInside = await client.query(
      "SELECT candidate_code FROM media_career_notifications WHERE candidate_code = $1 AND notification_type = 'HEALTH_WRITE_PROBE'",
      [probeCode]
    );
    const outboundInside = await client.query(
      "SELECT candidate_code FROM media_career_outbound_deliveries WHERE candidate_code = $1 AND delivery_type = 'HEALTH_WRITE_PROBE'",
      [probeCode]
    );

    if (
      candidateInside.rowCount !== 1
      || eventInside.rowCount !== 1
      || notificationInside.rowCount !== 1
      || outboundInside.rowCount !== 1
    ) {
      throw new Error("synthetic write verification failed inside transaction");
    }

    await client.query("ROLLBACK");
    transactionOpen = false;

    const candidateAfter = await pool.query(
      "SELECT candidate_code FROM media_career_applications WHERE candidate_code = $1",
      [probeCode]
    );
    const eventAfter = await pool.query(
      "SELECT candidate_code FROM media_career_events WHERE candidate_code = $1",
      [probeCode]
    );
    const notificationAfter = await pool.query(
      "SELECT candidate_code FROM media_career_notifications WHERE candidate_code = $1",
      [probeCode]
    );
    const outboundAfter = await pool.query(
      "SELECT candidate_code FROM media_career_outbound_deliveries WHERE candidate_code = $1",
      [probeCode]
    );

    if (candidateAfter.rowCount || eventAfter.rowCount || notificationAfter.rowCount || outboundAfter.rowCount) {
      throw new Error("synthetic write rollback verification failed");
    }

    res.json({
      ok: true,
      service: "hangdoi-academy-candidate-api",
      check: "intake-write-readiness",
      transaction: "rolled-back",
      verifiedTables: [
        "media_career_applications",
        "media_career_events",
        "media_career_notifications",
        "media_career_outbound_deliveries"
      ],
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("intake_write_health_rollback_failed", rollbackError?.message || rollbackError);
      }
    }
    console.error("intake_write_health_failed", error?.message || error);
    res.status(503).json({
      ok: false,
      service: "hangdoi-academy-candidate-api",
      check: "intake-write-readiness"
    });
  } finally {
    client.release();
  }
});



app.get("/health/outbound", async (_req, res) => {
  try {
    const statusRows = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM media_career_outbound_deliveries
      GROUP BY status
    `);
    const staleRows = await pool.query(`
      SELECT
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_open,
        SUM(CASE WHEN status = 'PROCESSING' AND last_attempt_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 1 ELSE 0 END) AS stale_processing,
        MAX(CASE
          WHEN status IN ('PENDING','RETRY') AND next_attempt_at < NOW()
          THEN TIMESTAMPDIFF(SECOND, next_attempt_at, NOW())
          ELSE 0
        END) AS max_overdue_seconds
      FROM media_career_outbound_deliveries
    `);

    const counts = Object.fromEntries(statusRows.rows.map((row) => [row.status, Number(row.count || 0)]));
    const stale = staleRows.rows[0] || {};
    const failedOpen = Number(stale.failed_open || 0);
    const staleProcessing = Number(stale.stale_processing || 0);
    const maxOverdueSeconds = Number(stale.max_overdue_seconds || 0);
    const degraded = failedOpen > 0 || staleProcessing > 0 || maxOverdueSeconds > 600;
    const configured = Array.from(outboundEndpointKeys).filter((key) => Boolean(outboundEndpoint(key)));
    const formats = Object.fromEntries(configured.map((key) => [key, outboundFormat(key)]));

    res.status(degraded ? 503 : 200).json({
      ok: !degraded,
      service: "hangdoi-academy-candidate-api",
      check: "outbound-delivery",
      configured,
      formats,
      supportedFormats: Array.from(outboundFormats),
      counts,
      failedOpen,
      staleProcessing,
      maxOverdueSeconds,
      worker: {
        intervalSeconds: OUTBOUND_DELIVERY_INTERVAL_MS / 1000,
        batchSize: OUTBOUND_DELIVERY_BATCH_SIZE
      }
    });
  } catch (error) {
    console.error("outbound_health_failed", error?.message || error);
    res.status(503).json({
      ok: false,
      service: "hangdoi-academy-candidate-api",
      check: "outbound-delivery"
    });
  }
});


app.get("/health/submissions", async (_req, res) => {
  try {
    const eventCounts = await pool.query(`
      SELECT event_name, COUNT(*) AS count
      FROM media_career_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND event_name IN ('form_submit_client','form_submit_error','application_received','application_retry_received')
      GROUP BY event_name
    `);
    const errorKinds = await pool.query(`
      SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.kind')), 'unknown') AS kind, COUNT(*) AS count
      FROM media_career_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND event_name = 'form_submit_error'
      GROUP BY kind
    `);

    const counts = Object.fromEntries(eventCounts.rows.map((row) => [row.event_name, Number(row.count || 0)]));
    const errorsByKind = Object.fromEntries(errorKinds.rows.map((row) => [String(row.kind || "unknown"), Number(row.count || 0)]));
    const clientSuccess = counts.form_submit_client || 0;
    const observedErrors = counts.form_submit_error || 0;
    const systemErrors = Object.entries(errorsByKind).reduce((total, [kind, count]) => {
      if (kind === "timeout" || kind === "network" || kind === "unknown" || /^http_5\d\d$/.test(kind)) {
        return total + count;
      }
      return total;
    }, 0);
    const systemAttempts = clientSuccess + systemErrors;
    const systemErrorRate = systemAttempts ? systemErrors / systemAttempts : 0;
    const degraded = systemAttempts >= 5 && systemErrors >= 3 && systemErrorRate >= 0.5;

    res.status(degraded ? 503 : 200).json({
      ok: !degraded,
      service: "hangdoi-academy-candidate-api",
      check: "submission-quality",
      windowHours: 24,
      counts: {
        clientSuccess,
        observedErrors,
        applicationReceived: counts.application_received || 0,
        deduplicatedRetries: counts.application_retry_received || 0
      },
      errorsByKind,
      systemErrors,
      systemAttempts,
      systemErrorRate: Math.round(systemErrorRate * 1000) / 1000,
      threshold: {
        minimumAttempts: 5,
        minimumSystemErrors: 3,
        maximumSystemErrorRate: 0.5
      }
    });
  } catch (error) {
    console.error("submission_health_failed", error?.message || error);
    res.status(503).json({
      ok: false,
      service: "hangdoi-academy-candidate-api",
      check: "submission-quality"
    });
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
    if (!careerWhy) missing.push("careerWhy");
    if (!privacyConsent) missing.push("privacyConsent");

    if (missing.length) {
      return res.status(400).json({ ok: false, error: "Missing required fields", fields: missing });
    }

    const cohort = "01";
    const publicPipelineStage = "INTEREST_REGISTERED";

    const existing = await pool.query(
      "SELECT candidate_code, phone, submitted_at FROM media_career_applications WHERE cohort = $1 AND email_normalized = $2",
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
        city, current_status, preferred_track, experience_level, portfolio_url, pipeline_stage,
        utm_source, utm_medium, utm_campaign, utm_content, referrer,
        marketing_consent, privacy_consent, payload
      ) VALUES (
        $1,$2,$3,NULLIF($4,'')::date,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21::jsonb
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
        pipeline_stage = CASE
          WHEN media_career_applications.pipeline_stage = 'INTEREST_REGISTERED'
            THEN EXCLUDED.pipeline_stage
          ELSE media_career_applications.pipeline_stage
        END,
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
      cleanString(b.portfolioUrl, 1000), publicPipelineStage,
      cleanString(b.utmSource, 180), cleanString(b.utmMedium, 180),
      cleanString(b.utmCampaign, 180), cleanString(b.utmContent, 180),
      cleanString(b.referrer, 1000),
      b.marketingConsent === true, privacyConsent, JSON.stringify(payload)
    ]);

    const saved = result.rows[0];
    const previousSubmittedAt = existing.rowCount ? new Date(existing.rows[0].submitted_at).getTime() : 0;
    const recentRetry = existing.rowCount > 0
      && Number.isFinite(previousSubmittedAt)
      && Date.now() - previousSubmittedAt >= 0
      && Date.now() - previousSubmittedAt <= 10 * 60 * 1000;

    let completedRecentRetry = false;
    if (recentRetry) {
      const priorNotification = await pool.query(
        `SELECT id
         FROM media_career_notifications
         WHERE candidate_code = $1
           AND notification_type = 'NEW_APPLICATION'
         ORDER BY created_at DESC
         LIMIT 1`,
        [saved.candidate_code]
      );
      completedRecentRetry = priorNotification.rowCount > 0;
    }

    if (completedRecentRetry) {
      await recordEvent({
        eventName: "application_retry_received",
        candidateCode: saved.candidate_code,
        path: "/media-career-program/apply/",
        utmSource: b.utmSource,
        utmMedium: b.utmMedium,
        utmCampaign: b.utmCampaign,
        utmContent: b.utmContent,
        referrer: b.referrer,
        metadata: { cohort, retryWindowMinutes: 10, priorNotification: true }
      });

      return res.status(200).json({
        ok: true,
        candidateCode: saved.candidate_code,
        submittedAt: saved.submitted_at,
        intakeMode: "INTEREST_ONLY",
        deduplicatedRetry: true
      });
    }

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

    const notificationPayload = {
      candidateCode: saved.candidate_code,
      fullName,
      email,
      phone,
      preferredTrack: cleanString(b.preferredTrack, 100),
      utmSource: cleanString(b.utmSource, 180),
      utmContent: cleanString(b.utmContent, 180),
      submittedAt: saved.submitted_at
    };
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
    const acknowledgementPayload = {
      type: "APPLICATION_ACK",
      candidateCode: saved.candidate_code,
      fullName,
      email,
      submittedAt: saved.submitted_at
    };
    const outboundJobs = configuredOutboundJobs(webhookPayload, acknowledgementPayload);
    const deliveryClient = await pool.connect();
    try {
      await deliveryClient.query("BEGIN");
      await deliveryClient.query(`
        INSERT INTO media_career_notifications (
          candidate_code, notification_type, payload
        ) VALUES ($1, 'NEW_APPLICATION', $2::jsonb)
      `, [saved.candidate_code, JSON.stringify(notificationPayload)]);
      await enqueueOutboundJobs(deliveryClient, saved.candidate_code, outboundJobs);
      await deliveryClient.query("COMMIT");
    } catch (deliveryError) {
      try { await deliveryClient.query("ROLLBACK"); } catch {}
      throw deliveryError;
    } finally {
      deliveryClient.release();
    }

    if (outboundJobs.length) void processOutboundDeliveries();

    res.status(201).json({
      ok: true,
      candidateCode: saved.candidate_code,
      submittedAt: saved.submitted_at,
      intakeMode: "INTEREST_ONLY"
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
    const legal = await client.query(
      "SELECT program_registration_status FROM media_career_legal_readiness WHERE cohort = '01'"
    );
    if (legal.rows[0]?.program_registration_status !== "CONFIRMED") {
      await client.query("ROLLBACK");
      return res.status(423).json({ ok: false, error: "Formal Selection is temporarily locked" });
    }
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
    .filter(([key]) => key.endsWith("_status") && key !== "final_approval_status")
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
    publicIntakeMode: "INTEREST_ONLY",
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
    .filter(([key]) => key.endsWith("_status") && key !== "final_approval_status")
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
  const candidate = result.rows[0];
  const [history, assessment, admission, selection, outbound] = await Promise.all([
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
    `, [req.params.id]),
    pool.query(`
      SELECT id, delivery_type, endpoint_key, status, attempt_count, max_attempts,
             next_attempt_at, last_attempt_at, delivered_at,
             last_status_code, last_error, created_at, updated_at
      FROM media_career_outbound_deliveries
      WHERE candidate_code = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [candidate.candidate_code])
  ]);
  res.json({
    ok: true,
    application: candidate,
    history: history.rows,
    assessment: assessment.rows[0] || null,
    admission: admission.rows[0] || null,
    selection: selection.rows[0] || null,
    outboundDeliveries: outbound.rows,
    admissionLegalGate: "BLOCKED"
  });
});

app.patch("/v1/admin/applications/:id/selection", requireAdmin, async (req, res) => {
  const application = await pool.query(
    "SELECT id, candidate_code, pipeline_stage FROM media_career_applications WHERE id = $1",
    [req.params.id]
  );
  if (!application.rowCount) return res.status(404).json({ ok: false, error: "Not found" });
  const legal = await pool.query(
    "SELECT program_registration_status FROM media_career_legal_readiness WHERE cohort = '01'"
  );
  if (legal.rows[0]?.program_registration_status !== "CONFIRMED") {
    return res.status(423).json({
      ok: false,
      error: "Formal Selection scheduling is locked until program registration is confirmed"
    });
  }
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
    const existingAssessment = await client.query(
      "SELECT id FROM media_career_assessments WHERE application_id = $1",
      [req.params.id]
    );
    if (appData.pipeline_stage !== "SELECTION_ATTENDED" && !existingAssessment.rowCount) {
      await client.query("ROLLBACK");
      return res.status(423).json({
        ok: false,
        error: "Assessment is locked until the candidate has attended Formal Selection"
      });
    }
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

app.get("/v1/admin/campaigns", requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 30), 1), 365);
  const result = await pool.query(`
    SELECT
      c.id, c.content_id, c.title, c.source, c.medium, c.campaign, c.status,
      c.owner, c.asset_type, c.target_publish_date,
      c.brief_ready, c.production_ready, c.edit_ready, c.copy_ready, c.qa_ready,
      c.asset_url, c.publish_url, c.notes, c.created_at, c.updated_at,
      COALESCE(ev.landing_views, 0)::int AS landing_views,
      COALESCE(ev.apply_views, 0)::int AS apply_views,
      COALESCE(ev.form_starts, 0)::int AS form_starts,
      COALESCE(ap.interests, 0)::int AS interests
    FROM media_career_campaigns c
    LEFT JOIN (
      SELECT
        utm_content,
        COUNT(DISTINCT CASE WHEN event_name = 'landing_view' THEN session_id END) AS landing_views,
        COUNT(DISTINCT CASE WHEN event_name = 'apply_view' THEN session_id END) AS apply_views,
        COUNT(DISTINCT CASE WHEN event_name = 'form_start' THEN session_id END) AS form_starts
      FROM media_career_events
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY utm_content
    ) ev ON ev.utm_content = c.content_id
    LEFT JOIN (
      SELECT utm_content, COUNT(*) AS interests
      FROM media_career_applications
      WHERE submitted_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY utm_content
    ) ap ON ap.utm_content = c.content_id
    ORDER BY
      CASE c.status
        WHEN 'PUBLISHED' THEN 1
        WHEN 'READY' THEN 2
        WHEN 'DRAFT' THEN 3
        WHEN 'IDEA' THEN 4
        WHEN 'PAUSED' THEN 5
        ELSE 6
      END,
      c.updated_at DESC
  `, [days]);
  const campaigns = result.rows.map(row => {
    const readiness = [
      row.brief_ready, row.production_ready, row.edit_ready, row.copy_ready, row.qa_ready
    ].filter(Boolean).length;
    return {
      ...row,
      readiness_pct: readiness * 20,
      landing_to_interest_pct: Number(row.landing_views) > 0
        ? Math.round((Number(row.interests) / Number(row.landing_views)) * 1000) / 10
        : 0
    };
  });
  res.json({ ok: true, days, campaigns });
});

app.patch("/v1/admin/campaigns/:contentId", requireAdmin, async (req, res) => {
  const contentId = cleanString(req.params.contentId, 180).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,178}[a-z0-9]$/.test(contentId)) {
    return res.status(400).json({ ok: false, error: "Invalid content ID" });
  }
  const b = req.body || {};
  const source = cleanString(b.source, 80).toLowerCase();
  const medium = cleanString(b.medium, 80).toLowerCase();
  const status = cleanString(b.status || "IDEA", 40).toUpperCase();
  if (!source || !medium) {
    return res.status(400).json({ ok: false, error: "Source and medium are required" });
  }
  if (!new Set(["IDEA","DRAFT","READY","PUBLISHED","PAUSED","ARCHIVED"]).has(status)) {
    return res.status(400).json({ ok: false, error: "Invalid campaign status" });
  }
  const result = await pool.query(`
    INSERT INTO media_career_campaigns (
      content_id, title, source, medium, campaign, status,
      owner, asset_type, target_publish_date,
      brief_ready, production_ready, edit_ready, copy_ready, qa_ready,
      asset_url, publish_url, notes, updated_at
    ) VALUES (
      $1,$2,$3,$4,'media_career_cohort01',$5,$6,$7,NULLIF($8,'')::date,
      $9,$10,$11,$12,$13,$14,$15,$16,NOW()
    )
    ON CONFLICT (content_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      source = EXCLUDED.source,
      medium = EXCLUDED.medium,
      status = EXCLUDED.status,
      owner = EXCLUDED.owner,
      asset_type = EXCLUDED.asset_type,
      target_publish_date = EXCLUDED.target_publish_date,
      brief_ready = EXCLUDED.brief_ready,
      production_ready = EXCLUDED.production_ready,
      edit_ready = EXCLUDED.edit_ready,
      copy_ready = EXCLUDED.copy_ready,
      qa_ready = EXCLUDED.qa_ready,
      asset_url = EXCLUDED.asset_url,
      publish_url = EXCLUDED.publish_url,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
  `, [
    contentId,
    cleanString(b.title, 240),
    source,
    medium,
    status,
    cleanString(b.owner, 160),
    cleanString(b.assetType, 80),
    cleanString(b.targetPublishDate, 20),
    b.briefReady === true,
    b.productionReady === true,
    b.editReady === true,
    b.copyReady === true,
    b.qaReady === true,
    cleanString(b.assetUrl, 1500),
    cleanString(b.publishUrl, 1500),
    cleanString(b.notes, 5000)
  ]);
  res.json({ ok: true, campaign: result.rows[0] });
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
        SUM(CASE WHEN pipeline_stage IN (
          'QUALIFIED','SELECTION_INVITED','SELECTION_CONFIRMED',
          'SELECTION_ATTENDED','PASS','WAITLIST','ADMITTED','ENROLLED'
        ) THEN 1 ELSE 0 END) AS qualified_or_beyond,
        SUM(CASE WHEN pipeline_stage IN (
          'SELECTION_INVITED','SELECTION_CONFIRMED','SELECTION_ATTENDED'
        ) THEN 1 ELSE 0 END) AS in_selection,
        SUM(CASE WHEN pipeline_stage IN ('PASS','ADMITTED','ENROLLED') THEN 1 ELSE 0 END) AS passed_or_beyond,
        SUM(CASE WHEN pipeline_stage IN ('ADMITTED','ENROLLED') THEN 1 ELSE 0 END) AS admitted_or_enrolled
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
        SUM(CASE WHEN pipeline_stage = 'PASS' THEN 1 ELSE 0 END) AS pass,
        SUM(CASE WHEN pipeline_stage = 'WAITLIST' THEN 1 ELSE 0 END) AS waitlist,
        SUM(CASE WHEN pipeline_stage = 'ADMITTED' THEN 1 ELSE 0 END) AS admitted,
        SUM(CASE WHEN pipeline_stage = 'ENROLLED' THEN 1 ELSE 0 END) AS enrolled
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

app.get("/v1/admin/outbound", requireAdmin, async (_req, res) => {
  const result = await pool.query(`
    SELECT id, candidate_code, delivery_type, endpoint_key, status,
           attempt_count, max_attempts, next_attempt_at, last_attempt_at,
           delivered_at, last_status_code, last_error, created_at, updated_at
    FROM media_career_outbound_deliveries
    ORDER BY created_at DESC
    LIMIT 100
  `);
  res.json({ ok: true, deliveries: result.rows });
});

app.post("/v1/admin/outbound/:id/retry", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    UPDATE media_career_outbound_deliveries
    SET status = 'RETRY',
        attempt_count = 0,
        next_attempt_at = NOW(),
        last_attempt_at = NULL,
        delivered_at = NULL,
        last_status_code = NULL,
        last_error = NULL,
        updated_at = NOW()
    WHERE id = $1
      AND status IN ('FAILED','RETRY')
    RETURNING id, candidate_code, delivery_type, status, next_attempt_at
  `, [req.params.id]);
  if (!result.rowCount) {
    return res.status(409).json({ ok: false, error: "Delivery is not retryable" });
  }
  void processOutboundDeliveries();
  res.json({ ok: true, delivery: result.rows[0] });
});

app.post("/v1/admin/outbound/test", requireAdmin, async (req, res) => {
  const requestedKey = cleanString(req.body?.endpointKey, 120);
  if (requestedKey && !outboundEndpointKeys.has(requestedKey)) {
    return res.status(400).json({ ok: false, error: "Unsupported outbound endpoint" });
  }

  const keys = requestedKey
    ? [requestedKey]
    : Array.from(outboundEndpointKeys).filter((key) => Boolean(outboundEndpoint(key)));
  const configuredKeys = keys.filter((key) => Boolean(outboundEndpoint(key)));
  if (!configuredKeys.length) {
    return res.status(409).json({
      ok: false,
      error: "No outbound endpoint is configured"
    });
  }

  const testCode = `SYSTEM-OUTBOUND-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  for (const endpointKey of configuredKeys) {
    const deliveryType = endpointKey === "NEW_APPLICATION_WEBHOOK_URL"
      ? "CONNECTION_TEST_NEW_APPLICATION"
      : "CONNECTION_TEST_APPLICATION_ACK";
    await pool.query(`
      INSERT INTO media_career_outbound_deliveries (
        candidate_code, delivery_type, endpoint_key, payload,
        status, attempt_count, max_attempts, next_attempt_at
      ) VALUES (
        $1,$2,$3,$4::jsonb,'PENDING',0,3,NOW()
      )
    `, [
      testCode,
      deliveryType,
      endpointKey,
      JSON.stringify({
        type: "ACADEMY_OUTBOUND_TEST",
        source: "admin",
        endpointKey,
        testCode,
        createdAt: new Date().toISOString()
      })
    ]);
  }

  const queued = await pool.query(`
    SELECT id, candidate_code, delivery_type, endpoint_key, status, created_at
    FROM media_career_outbound_deliveries
    WHERE candidate_code = $1
    ORDER BY id
  `, [testCode]);

  void processOutboundDeliveries();
  res.status(202).json({
    ok: true,
    testCode,
    queued: queued.rows
  });
});

app.patch("/v1/admin/applications/:id/stage", requireAdmin, async (req, res) => {
  const allowed = new Set([
    "INTEREST_REGISTERED", "APPLICATION_COMPLETED", "QUALIFIED", "SELECTION_INVITED", "SELECTION_CONFIRMED",
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
    if (stage === "ADMITTED" || stage === "ENROLLED") {
      await client.query("ROLLBACK");
      return res.status(423).json({
        ok: false,
        error: "ADMITTED/ENROLLED are blocked until the reviewed Admission/Enrollment implementation is explicitly unlocked"
      });
    }
    const gatedStages = new Set([
      "APPLICATION_COMPLETED", "QUALIFIED", "SELECTION_INVITED", "SELECTION_CONFIRMED",
      "SELECTION_ATTENDED", "PASS", "WAITLIST", "ADMITTED", "ENROLLED"
    ]);
    if (gatedStages.has(stage)) {
      const legal = await client.query(
        "SELECT program_registration_status FROM media_career_legal_readiness WHERE cohort = '01'"
      );
      if (legal.rows[0]?.program_registration_status !== "CONFIRMED") {
        await client.query("ROLLBACK");
        return res.status(423).json({
          ok: false,
          error: "Formal recruitment/Selection is locked until program registration is confirmed"
        });
      }
    }
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

async function mysqlRuntimeSmoke() {
  const client = await pool.connect();
  const suffix = crypto.randomBytes(6).toString("hex");
  const email = `mysql-smoke-${suffix}@example.invalid`;
  const code = `MYSQL-SMOKE-${suffix}`;
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      INSERT INTO media_career_applications (
        candidate_code, cohort, full_name, date_of_birth, phone, email, email_normalized,
        city, current_status, preferred_track, experience_level, portfolio_url, pipeline_stage,
        utm_source, utm_medium, utm_campaign, utm_content, referrer,
        marketing_consent, privacy_consent, payload
      ) VALUES (
        $1,$2,$3,NULLIF($4,'')::date,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21::jsonb
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
        pipeline_stage = EXCLUDED.pipeline_stage,
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
      code, "00", "MySQL Runtime Smoke", "", "000", email, email,
      "Smoke", "Smoke", "", "Smoke", "", "INTEREST_REGISTERED",
      "", "", "", "", "", false, true, JSON.stringify({ smoke: true })
    ]);

    if (!result.rowCount || result.rows[0]?.candidate_code !== code) {
      throw new Error("MySQL runtime application insert/read smoke check failed");
    }
    await client.query("ROLLBACK");
    console.log("[mysql-runtime] smoke_ok");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

initDb()
  .then(mysqlRuntimeSmoke)
  .then(() => app.listen(port, "0.0.0.0", () => {
    console.log(`candidate-api listening on ${port}`);
    startMysqlBackupScheduler(pool);
    startOutboundDeliveryWorker();
  }))
  .catch((error) => {
    console.error("db_init_failed", error);
    process.exit(1);
  });
