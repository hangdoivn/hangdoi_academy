import crypto from "node:crypto";
import zlib from "node:zlib";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";

const BACKUP_PREFIX = "mysql/daily";
const RETENTION_DAYS = 90;
const DEFAULT_BACKUP_UTC_HOUR = 18;
const DEFAULT_BACKUP_UTC_MINUTE = 15;

function backupConfig() {
  const bucket = process.env.BACKUP_BUCKET;
  const endpoint = process.env.BACKUP_ENDPOINT;
  const accessKeyId = process.env.BACKUP_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_SECRET_ACCESS_KEY;
  const region = process.env.BACKUP_REGION || "auto";

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    client: new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey }
    })
  };
}

function utcParts(date = new Date()) {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return { yyyy, mm, dd };
}

function dailyPrefix(date = new Date()) {
  const { yyyy, mm, dd } = utcParts(date);
  return `${BACKUP_PREFIX}/${yyyy}/${mm}/${dd}/`;
}

function backupKey(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  return `${dailyPrefix(date)}hangdoi-academy-${stamp}.json.gz`;
}

function jsonReplacer(_key, value) {
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) {
    return { __type: "buffer", base64: value.toString("base64") };
  }
  return value;
}

async function captureDatabase(pool) {
  const connection = await pool.rawPool.getConnection();
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");

    const [[dbRow]] = await connection.query("SELECT DATABASE() AS database_name");
    const [tableRows] = await connection.query(`
      SELECT TABLE_NAME AS table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    const tables = [];
    for (const tableRow of tableRows) {
      const name = String(tableRow.table_name || "");
      if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new Error(`Unsafe table name encountered: ${name}`);
      }

      const [createRows] = await connection.query(`SHOW CREATE TABLE \`${name}\``);
      const createSql = createRows?.[0]?.["Create Table"] || Object.values(createRows?.[0] || {})[1];
      const [rows] = await connection.query(`SELECT * FROM \`${name}\``);

      tables.push({
        name,
        createSql,
        rowCount: rows.length,
        rows
      });
    }

    await connection.query("ROLLBACK");

    return {
      format: "hangdoi-academy-mysql-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      database: dbRow?.database_name || "unknown",
      transactionIsolation: "REPEATABLE READ / CONSISTENT SNAPSHOT",
      tables
    };
  } catch (error) {
    try { await connection.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    connection.release();
  }
}

async function hasBackupForToday(client, bucket, now = new Date()) {
  const response = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: dailyPrefix(now),
    MaxKeys: 1
  }));
  return Array.isArray(response.Contents) && response.Contents.length > 0;
}

async function pruneOldBackups(client, bucket, now = new Date()) {
  const cutoff = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let continuationToken;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${BACKUP_PREFIX}/`,
      ContinuationToken: continuationToken
    }));

    for (const object of response.Contents || []) {
      if (!object.Key?.endsWith(".json.gz")) continue;
      const modified = object.LastModified ? new Date(object.LastModified).getTime() : 0;
      if (!modified || modified >= cutoff) continue;

      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: object.Key
      }));
      console.log("[mysql-backup] pruned", object.Key);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
}

async function objectBodyToBuffer(body) {
  if (!body) throw new Error("Backup manifest body is empty");
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function getMysqlBackupStatus({ maxAgeHours = 30 } = {}) {
  const config = backupConfig();
  if (!config) {
    return { ok: false, status: "disabled", maxAgeHours };
  }

  try {
    const response = await config.client.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: "mysql/latest.json"
    }));
    const manifest = JSON.parse((await objectBodyToBuffer(response.Body)).toString("utf8"));
    const createdAtMs = Date.parse(manifest.createdAt || "");
    if (!Number.isFinite(createdAtMs)) {
      return { ok: false, status: "invalid_manifest", maxAgeHours };
    }

    const ageHoursRaw = Math.max(0, (Date.now() - createdAtMs) / 3_600_000);
    const ageHours = Math.round(ageHoursRaw * 10) / 10;
    const ok = ageHoursRaw <= maxAgeHours;

    return {
      ok,
      status: ok ? "fresh" : "stale",
      createdAt: new Date(createdAtMs).toISOString(),
      ageHours,
      maxAgeHours,
      bytes: Number(manifest.bytes || 0),
      tableCount: Number(manifest.tableCount || 0)
    };
  } catch (error) {
    console.error("[mysql-backup] status_failed", error?.message || error);
    return { ok: false, status: "unavailable", maxAgeHours };
  }
}

export async function runMysqlBackup(pool, { reason = "scheduled", force = false } = {}) {
  const config = backupConfig();
  if (!config) {
    console.log("[mysql-backup] disabled_missing_bucket_config");
    return { ok: false, skipped: true, reason: "missing_config" };
  }

  const now = new Date();
  if (!force && await hasBackupForToday(config.client, config.bucket, now)) {
    console.log("[mysql-backup] skip_existing_daily_backup", reason);
    return { ok: true, skipped: true, reason: "already_exists" };
  }

  const snapshot = await captureDatabase(pool);
  const json = JSON.stringify(snapshot, jsonReplacer);
  const body = zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  const sha256 = crypto.createHash("sha256").update(body).digest("hex");
  const key = backupKey(now);
  const rowCounts = Object.fromEntries(snapshot.tables.map(table => [table.name, table.rowCount]));

  await config.client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: "application/json",
    ContentEncoding: "gzip",
    Metadata: {
      sha256,
      format: "hangdoi-academy-mysql-backup-v1"
    }
  }));

  const manifest = {
    ok: true,
    key,
    createdAt: snapshot.createdAt,
    sha256,
    bytes: body.length,
    tableCount: snapshot.tables.length,
    rowCounts
  };

  await config.client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: "mysql/latest.json",
    Body: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    ContentType: "application/json"
  }));

  await pruneOldBackups(config.client, config.bucket, now);

  console.log("[mysql-backup] uploaded", JSON.stringify({
    key,
    bytes: body.length,
    tableCount: snapshot.tables.length,
    reason
  }));

  return manifest;
}

function msUntilNextDailyRun(now = new Date()) {
  const hour = Number(process.env.BACKUP_UTC_HOUR ?? DEFAULT_BACKUP_UTC_HOUR);
  const minute = Number(process.env.BACKUP_UTC_MINUTE ?? DEFAULT_BACKUP_UTC_MINUTE);
  const safeHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_BACKUP_UTC_HOUR;
  const safeMinute = Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : DEFAULT_BACKUP_UTC_MINUTE;

  const next = new Date(now);
  next.setUTCHours(safeHour, safeMinute, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

export function startMysqlBackupScheduler(pool) {
  if (!backupConfig()) {
    console.log("[mysql-backup] scheduler_disabled_missing_bucket_config");
    return;
  }

  const runSafely = async (reason) => {
    try {
      await runMysqlBackup(pool, { reason });
    } catch (error) {
      console.error("[mysql-backup] failed", error?.message || error);
    }
  };

  const scheduleNext = () => {
    const delay = msUntilNextDailyRun();
    const timer = setTimeout(async () => {
      await runSafely("scheduled");
      scheduleNext();
    }, delay);
    timer.unref();
  };

  const startupTimer = setTimeout(() => {
    void runSafely("startup");
  }, 30_000);
  startupTimer.unref();

  scheduleNext();
  console.log("[mysql-backup] scheduler_started", {
    utcHour: Number(process.env.BACKUP_UTC_HOUR ?? DEFAULT_BACKUP_UTC_HOUR),
    utcMinute: Number(process.env.BACKUP_UTC_MINUTE ?? DEFAULT_BACKUP_UTC_MINUTE),
    retentionDays: RETENTION_DAYS
  });
}
