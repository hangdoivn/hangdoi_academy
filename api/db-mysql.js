import mysql from "mysql2/promise";

function mysqlTypeCast(field, next) {
  if (field.type === "TINY" && field.length === 1) {
    const value = field.string();
    return value === null ? null : value === "1";
  }
  if (field.type === "JSON") {
    const value = field.string();
    if (value === null) return null;
    try { return JSON.parse(value); } catch { return value; }
  }
  return next();
}

function stripPgCasts(sql) {
  return sql
    .replace(/::jsonb\b/gi, "")
    .replace(/::timestamptz\b/gi, "")
    .replace(/::timestamp\b/gi, "")
    .replace(/::date\b/gi, "")
    .replace(/::int\b/gi, "")
    .replace(/::text\b/gi, "");
}

function translateInterval(sql) {
  return sql.replace(
    /NOW\(\)\s*-\s*\(\$(\d+)::text\s*\|\|\s*' days'\)::interval/gi,
    "DATE_SUB(NOW(), INTERVAL $$1 DAY)"
  );
}

function translateConflict(sql) {
  let out = sql;
  out = out.replace(
    /ON\s+CONFLICT\s*\(([^)]+)\)\s+DO\s+NOTHING/gi,
    (_m, cols) => {
      const first = String(cols).split(",")[0].trim().replace(/"/g, "");
      return `ON DUPLICATE KEY UPDATE ${first} = ${first}`;
    }
  );
  out = out.replace(
    /ON\s+CONFLICT\s*\(([^)]+)\)\s+DO\s+UPDATE\s+SET/gi,
    "ON DUPLICATE KEY UPDATE"
  );
  out = out.replace(/\bEXCLUDED\.([a-zA-Z0-9_]+)/g, "VALUES($1)");
  return out;
}

function translateForUpdate(sql) {
  return sql.replace(/FOR\s+UPDATE\s+OF\s+[a-zA-Z0-9_,\s]+(?=$|[\n\r])/gi, "FOR UPDATE");
}

function convertPlaceholders(sql, params) {
  const ordered = [];
  const converted = sql.replace(/\$(\d+)/g, (_m, n) => {
    ordered.push(params[Number(n) - 1]);
    return "?";
  });
  return { sql: converted, params: ordered };
}

function returningSelector(table, originalSql, originalParams) {
  const updateWhere = originalSql.match(/\bWHERE\s+([a-zA-Z0-9_]+)\s*=\s*\$(\d+)\s*(?:$|RETURNING|FOR|ORDER|LIMIT)/i);
  if (/^\s*UPDATE\b/i.test(originalSql) && updateWhere) {
    return { column: updateWhere[1], value: originalParams[Number(updateWhere[2]) - 1] };
  }

  if (!/^\s*INSERT\b/i.test(originalSql)) return null;
  switch (table) {
    case "media_career_applications":
      return { columns: ["cohort","email_normalized"], values: [originalParams[1], originalParams[6]] };
    case "media_career_legal_readiness":
      return { column: "cohort", value: originalParams[0] };
    case "media_career_selection_appointments":
    case "media_career_assessments":
    case "media_career_admissions":
      return { column: "application_id", value: originalParams[0] };
    case "media_career_campaigns":
      return { column: "content_id", value: originalParams[0] };
    case "media_career_cohorts":
      return { column: "cohort", value: originalParams[0] };
    default:
      return null;
  }
}

async function selectReturning(raw, table, returning, selector) {
  if (!selector) return [];
  const fields = returning.trim() === "*" ? "*" : returning.trim();
  if (selector.columns) {
    const where = selector.columns.map(col => `\`${col}\` = ?`).join(" AND ");
    const [rows] = await raw.query(`SELECT ${fields} FROM \`${table}\` WHERE ${where} LIMIT 1`, selector.values);
    return rows;
  }
  const [rows] = await raw.query(
    `SELECT ${fields} FROM \`${table}\` WHERE \`${selector.column}\` = ? LIMIT 1`,
    [selector.value]
  );
  return rows;
}

function createQueryAdapter(raw) {
  return {
    async query(sql, params = []) {
      if (typeof sql !== "string") throw new TypeError("SQL must be a string");
      const originalSql = sql.trim();
      const originalParams = Array.isArray(params) ? params : [];

      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(originalSql)) {
        if (/^BEGIN$/i.test(originalSql)) await raw.beginTransaction();
        else if (/^COMMIT$/i.test(originalSql)) await raw.commit();
        else await raw.rollback();
        return { rows: [], rowCount: 0 };
      }

      let returning = null;
      let statement = originalSql;
      const returningMatch = statement.match(/\s+RETURNING\s+([\s\S]+)$/i);
      if (returningMatch) {
        returning = returningMatch[1].trim();
        statement = statement.slice(0, returningMatch.index).trim();
      }

      const tableMatch = statement.match(/^\s*(?:INSERT\s+INTO|UPDATE)\s+([a-zA-Z0-9_]+)/i);
      const table = tableMatch ? tableMatch[1] : null;
      const selector = returning && table ? returningSelector(table, originalSql, originalParams) : null;

      statement = translateInterval(statement);
      statement = stripPgCasts(statement);
      statement = translateConflict(statement);
      statement = translateForUpdate(statement);
      const converted = convertPlaceholders(statement, originalParams);

      const [result] = await raw.query(converted.sql, converted.params);

      if (returning && table) {
        const rows = await selectReturning(raw, table, returning, selector);
        return { rows, rowCount: rows.length };
      }

      if (Array.isArray(result)) {
        return { rows: result, rowCount: result.length };
      }
      return { rows: [], rowCount: Number(result?.affectedRows || 0) };
    },
    release() {
      if (typeof raw.release === "function") raw.release();
    }
  };
}

export function createMySqlPool(connectionString = process.env.MYSQL_URL) {
  if (!connectionString) throw new Error("MYSQL_URL is required");
  const rawPool = mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z",
    charset: "utf8mb4",
    typeCast: mysqlTypeCast
  });

  const adapter = createQueryAdapter(rawPool);
  return {
    ...adapter,
    rawPool,
    async connect() {
      const connection = await rawPool.getConnection();
      await connection.query("SET time_zone = '+00:00'");
      return createQueryAdapter(connection);
    },
    async rawQuery(sql, params = []) {
      return rawPool.query(sql, params);
    },
    async end() {
      await rawPool.end();
    }
  };
}

export async function initMySqlSchema(pool) {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS media_career_cohorts (
      cohort VARCHAR(20) PRIMARY KEY,
      target_enrollment INT NOT NULL DEFAULT 10,
      status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_legal_readiness (
      cohort VARCHAR(20) PRIMARY KEY,
      operating_entity_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      program_classification_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      activity_conditions_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      program_registration_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      curriculum_standard_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      certificate_wording_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      tuition_disclosure_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      enrollment_agreement_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      refund_deferral_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      invoice_tax_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      production_exposure_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      employment_separation_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      privacy_terms_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      counsel_reference TEXT NULL,
      authority_reference TEXT NULL,
      reviewed_by VARCHAR(240) NULL,
      reviewed_at DATETIME(3) NULL,
      notes LONGTEXT NULL,
      final_approval_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      final_approval_reference TEXT NULL,
      final_approved_by VARCHAR(240) NULL,
      final_approved_at DATETIME(3) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_applications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      candidate_code VARCHAR(160) NOT NULL UNIQUE,
      cohort VARCHAR(20) NOT NULL DEFAULT '01',
      full_name VARCHAR(160) NOT NULL,
      date_of_birth DATE NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(320) NOT NULL,
      email_normalized VARCHAR(320) NOT NULL,
      city VARCHAR(160) NULL,
      current_status VARCHAR(100) NULL,
      preferred_track VARCHAR(100) NULL,
      experience_level VARCHAR(100) NULL,
      portfolio_url VARCHAR(1000) NULL,
      pipeline_stage VARCHAR(80) NOT NULL DEFAULT 'APPLICATION_COMPLETED',
      utm_source VARCHAR(180) NULL,
      utm_medium VARCHAR(180) NULL,
      utm_campaign VARCHAR(180) NULL,
      utm_content VARCHAR(180) NULL,
      referrer VARCHAR(1000) NULL,
      marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
      privacy_consent BOOLEAN NOT NULL DEFAULT TRUE,
      payload JSON NOT NULL,
      owner VARCHAR(160) NULL,
      next_action VARCHAR(1000) NULL,
      next_action_date DATE NULL,
      lost_reason VARCHAR(160) NULL,
      internal_notes LONGTEXT NULL,
      submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uk_mcp_cohort_email (cohort,email_normalized),
      KEY idx_mcp_stage (pipeline_stage),
      KEY idx_mcp_source (utm_source),
      KEY idx_mcp_submitted (submitted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_stage_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      application_id BIGINT UNSIGNED NOT NULL,
      candidate_code VARCHAR(160) NOT NULL,
      from_stage VARCHAR(80) NULL,
      to_stage VARCHAR(80) NOT NULL,
      changed_by VARCHAR(160) NOT NULL DEFAULT 'admin',
      changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_mcp_stage_history_application (application_id,changed_at),
      CONSTRAINT fk_mcp_stage_history_application FOREIGN KEY (application_id)
        REFERENCES media_career_applications(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_assessments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      application_id BIGINT UNSIGNED NOT NULL UNIQUE,
      visual_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      learning_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      execution_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      behaviour_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      motivation_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      total_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      assessor VARCHAR(160) NULL,
      selection_notes LONGTEXT NULL,
      interview_notes LONGTEXT NULL,
      decision VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_mcp_assessment_decision (decision,updated_at),
      CONSTRAINT fk_mcp_assessment_application FOREIGN KEY (application_id)
        REFERENCES media_career_applications(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_admissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      application_id BIGINT UNSIGNED NOT NULL UNIQUE,
      status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
      program_name VARCHAR(240) NOT NULL DEFAULT 'Hang Đôi Media Career Program',
      cohort VARCHAR(20) NOT NULL DEFAULT '01',
      tuition_amount BIGINT NOT NULL DEFAULT 40000000,
      payment_plan VARCHAR(1000) NOT NULL DEFAULT '40.000.000 VNĐ một lần hoặc 10.000.000 VNĐ × 4 kỳ',
      proposed_start_date DATE NULL,
      response_deadline DATE NULL,
      schedule_note LONGTEXT NULL,
      admission_note LONGTEXT NULL,
      prepared_by VARCHAR(160) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_mcp_admission_status (status,updated_at),
      CONSTRAINT fk_mcp_admission_application FOREIGN KEY (application_id)
        REFERENCES media_career_applications(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_selection_appointments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      application_id BIGINT UNSIGNED NOT NULL UNIQUE,
      public_token VARCHAR(160) NOT NULL UNIQUE,
      selection_start DATETIME(3) NULL,
      duration_minutes INT NOT NULL DEFAULT 90,
      timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
      mode VARCHAR(40) NOT NULL DEFAULT 'ONSITE',
      location VARCHAR(1000) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
      invitation_note LONGTEXT NULL,
      prep_note LONGTEXT NULL,
      candidate_response_note LONGTEXT NULL,
      confirmed_at DATETIME(3) NULL,
      declined_at DATETIME(3) NULL,
      attended_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_mcp_selection_status (status,updated_at),
      CONSTRAINT fk_mcp_selection_application FOREIGN KEY (application_id)
        REFERENCES media_career_applications(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_campaigns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      content_id VARCHAR(180) NOT NULL UNIQUE,
      title VARCHAR(240) NULL,
      source VARCHAR(80) NOT NULL,
      medium VARCHAR(80) NOT NULL,
      campaign VARCHAR(180) NOT NULL DEFAULT 'media_career_cohort01',
      status VARCHAR(40) NOT NULL DEFAULT 'IDEA',
      owner VARCHAR(160) NULL,
      asset_type VARCHAR(80) NULL,
      target_publish_date DATE NULL,
      brief_ready BOOLEAN NOT NULL DEFAULT FALSE,
      production_ready BOOLEAN NOT NULL DEFAULT FALSE,
      edit_ready BOOLEAN NOT NULL DEFAULT FALSE,
      copy_ready BOOLEAN NOT NULL DEFAULT FALSE,
      qa_ready BOOLEAN NOT NULL DEFAULT FALSE,
      asset_url VARCHAR(1500) NULL,
      publish_url VARCHAR(1500) NULL,
      notes LONGTEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_mcp_campaign_status (status,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      event_name VARCHAR(80) NOT NULL,
      session_id VARCHAR(160) NULL,
      candidate_code VARCHAR(160) NULL,
      path VARCHAR(500) NULL,
      utm_source VARCHAR(180) NULL,
      utm_medium VARCHAR(180) NULL,
      utm_campaign VARCHAR(180) NULL,
      utm_content VARCHAR(180) NULL,
      referrer VARCHAR(1000) NULL,
      metadata JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_mcp_events_name_created (event_name,created_at),
      KEY idx_mcp_events_session (session_id),
      KEY idx_mcp_events_candidate (candidate_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media_career_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      candidate_code VARCHAR(160) NULL,
      notification_type VARCHAR(80) NOT NULL,
      payload JSON NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'UNREAD',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      read_at DATETIME(3) NULL,
      KEY idx_mcp_notifications_status (status,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  await pool.rawQuery("SET time_zone = '+00:00'");
  for (const statement of ddl) await pool.rawQuery(statement);
  await pool.rawQuery(
    "INSERT IGNORE INTO media_career_cohorts (cohort,target_enrollment,status) VALUES ('01',10,'OPEN')"
  );
  await pool.rawQuery(
    "INSERT IGNORE INTO media_career_legal_readiness (cohort) VALUES ('01')"
  );
}
