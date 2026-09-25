import { createMySqlPool, initMySqlSchema } from "./db-mysql.js";

const TABLES = [
  "media_career_cohorts",
  "media_career_legal_readiness",
  "media_career_applications",
  "media_career_stage_history",
  "media_career_assessments",
  "media_career_admissions",
  "media_career_selection_appointments",
  "media_career_campaigns",
  "media_career_events",
  "media_career_notifications"
];

const JSON_COLUMNS = new Set(["payload", "metadata"]);

function targetValue(column, value) {
  if (JSON_COLUMNS.has(column)) {
    if (value === null || value === undefined) return "{}";
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

async function copyTable(source, target, table) {
  const result = await source.query(`SELECT * FROM ${table} ORDER BY 1`);
  if (!result.rows.length) return 0;

  for (const row of result.rows) {
    const columns = Object.keys(row);
    const quoted = columns.map(c => `\`${c}\``).join(",");
    const placeholders = columns.map(() => "?").join(",");
    const updates = columns
      .filter(c => c !== "id")
      .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
      .join(",");
    const first = quoted.split(",")[0];
    const sql = `INSERT INTO \`${table}\` (${quoted}) VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updates || first + "=" + first}`;
    const values = columns.map(c => targetValue(c, row[c]));
    await target.query(sql, values);
  }

  if (Object.prototype.hasOwnProperty.call(result.rows[0], "id")) {
    const maxId = Math.max(...result.rows.map(row => Number(row.id) || 0));
    if (maxId > 0) {
      await target.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${maxId + 1}`);
    }
  }
  return result.rows.length;
}

async function countPg(db, table) {
  const r = await db.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return Number(r.rows[0].count);
}

async function countMySql(db, table) {
  const [rows] = await db.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  return Number(rows[0].count);
}

export async function migratePostgresToMysql(pgPool, mysqlUrl, { logger = console } = {}) {
  if (!mysqlUrl) throw new Error("mysqlUrl is required");

  const mysqlPool = createMySqlPool(mysqlUrl);
  await initMySqlSchema(mysqlPool);

  const source = await pgPool.connect();
  const target = await mysqlPool.rawPool.getConnection();
  const report = [];

  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await target.beginTransaction();
    await target.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of TABLES) {
      const copied = await copyTable(source, target, table);
      report.push({ table, copied });
      logger.info?.(`[mysql-shadow] copied ${table}: ${copied}`);
    }

    await target.query("SET FOREIGN_KEY_CHECKS = 1");
    await target.commit();
    await source.query("COMMIT");

    for (const item of report) {
      item.postgres = await countPg(pgPool, item.table);
      item.mysql = await countMySql(mysqlPool.rawPool, item.table);
      item.match = item.postgres === item.mysql;
    }

    const candidatePg = await pgPool.query(
      "SELECT COUNT(*)::int AS count, COUNT(DISTINCT candidate_code)::int AS distinct_codes FROM media_career_applications"
    );
    const [candidateMy] = await mysqlPool.rawPool.query(
      "SELECT COUNT(*) AS count, COUNT(DISTINCT candidate_code) AS distinct_codes FROM media_career_applications"
    );

    const candidateMatch =
      Number(candidatePg.rows[0].count) === Number(candidateMy[0].count) &&
      Number(candidatePg.rows[0].distinct_codes) === Number(candidateMy[0].distinct_codes);

    const mismatches = report.filter(item => !item.match);
    if (mismatches.length || !candidateMatch) {
      const names = mismatches.map(item => item.table).join(", ") || "candidate identity check";
      throw new Error(`MySQL shadow verification failed: ${names}`);
    }

    logger.info?.("[mysql-shadow] MIGRATION_OK");
    return { ok: true, report, candidateMatch };
  } catch (error) {
    try { await target.rollback(); } catch {}
    try { await source.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    target.release();
    source.release();
    await mysqlPool.end();
  }
}
