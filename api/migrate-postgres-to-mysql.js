import pg from "pg";
import { createMySqlPool, initMySqlSchema } from "./db-mysql.js";

const { Pool: PgPool } = pg;
const sourceUrl = process.env.POSTGRES_URL || process.env.PG_DATABASE_URL;
const targetUrl = process.env.MYSQL_URL;

if (!sourceUrl) throw new Error("POSTGRES_URL (or PG_DATABASE_URL) is required");
if (!targetUrl) throw new Error("MYSQL_URL is required");

const sourcePool = new PgPool({
  connectionString: sourceUrl,
  ssl: sourceUrl.includes("railway.internal") ? false : { rejectUnauthorized: false }
});
const targetPool = createMySqlPool(targetUrl);

const tables = [
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

const jsonColumns = new Set(["payload","metadata"]);

function targetValue(column, value) {
  if (jsonColumns.has(column)) {
    if (value === null || value === undefined) return "{}";
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

async function copyTable(source, target, table) {
  const result = await source.query(`SELECT * FROM \${table} ORDER BY 1`);
  if (!result.rows.length) return 0;

  for (const row of result.rows) {
    const columns = Object.keys(row);
    const quoted = columns.map(c => `\`\${c}\``).join(",");
    const placeholders = columns.map(() => "?").join(",");
    const updates = columns
      .filter(c => c !== "id")
      .map(c => `\`\${c}\` = VALUES(\`\${c}\`)`)
      .join(",");
    const sql = `INSERT INTO \`\${table}\` (\${quoted}) VALUES (\${placeholders})
      ON DUPLICATE KEY UPDATE \${updates || quoted.split(",")[0] + "=" + quoted.split(",")[0]}`;
    const values = columns.map(c => targetValue(c, row[c]));
    await target.query(sql, values);
  }

  if (Object.prototype.hasOwnProperty.call(result.rows[0], "id")) {
    const maxId = Math.max(...result.rows.map(row => Number(row.id) || 0));
    if (maxId > 0) {
      await target.query(`ALTER TABLE \`\${table}\` AUTO_INCREMENT = \${maxId + 1}`);
    }
  }
  return result.rows.length;
}

async function countTable(db, engine, table) {
  if (engine === "pg") {
    const r = await db.query(`SELECT COUNT(*)::int AS count FROM \${table}`);
    return Number(r.rows[0].count);
  }
  const [rows] = await db.query(`SELECT COUNT(*) AS count FROM \`\${table}\``);
  return Number(rows[0].count);
}

async function main() {
  await initMySqlSchema(targetPool);

  const source = await sourcePool.connect();
  const target = await targetPool.rawPool.getConnection();
  const report = [];

  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await target.beginTransaction();
    await target.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of tables) {
      const copied = await copyTable(source, target, table);
      report.push({ table, copied });
      console.log(`[copy] \${table}: \${copied}`);
    }

    await target.query("SET FOREIGN_KEY_CHECKS = 1");
    await target.commit();
    await source.query("COMMIT");

    for (const item of report) {
      const pgCount = await countTable(sourcePool, "pg", item.table);
      const myCount = await countTable(targetPool.rawPool, "mysql", item.table);
      item.postgres = pgCount;
      item.mysql = myCount;
      item.match = pgCount === myCount;
    }

    const mismatches = report.filter(item => !item.match);
    console.table(report);
    if (mismatches.length) {
      throw new Error(`Migration verification failed for: \${mismatches.map(x => x.table).join(", ")}`);
    }

    const pgCandidates = await sourcePool.query(
      "SELECT COUNT(*)::int AS count, COUNT(DISTINCT candidate_code)::int AS distinct_codes FROM media_career_applications"
    );
    const [myCandidates] = await targetPool.rawPool.query(
      "SELECT COUNT(*) AS count, COUNT(DISTINCT candidate_code) AS distinct_codes FROM media_career_applications"
    );

    if (
      Number(pgCandidates.rows[0].count) !== Number(myCandidates[0].count) ||
      Number(pgCandidates.rows[0].distinct_codes) !== Number(myCandidates[0].distinct_codes)
    ) {
      throw new Error("Candidate verification failed");
    }

    console.log("MIGRATION_OK");
  } catch (error) {
    try { await target.rollback(); } catch {}
    try { await source.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    target.release();
    source.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

main().catch(error => {
  console.error("MIGRATION_FAILED", error);
  process.exit(1);
});
