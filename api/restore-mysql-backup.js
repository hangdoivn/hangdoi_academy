import crypto from "node:crypto";
import zlib from "node:zlib";
import mysql from "mysql2/promise";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function s3Config() {
  return {
    bucket: required("BACKUP_BUCKET"),
    client: new S3Client({
      endpoint: required("BACKUP_ENDPOINT"),
      region: process.env.BACKUP_REGION || "auto",
      credentials: {
        accessKeyId: required("BACKUP_ACCESS_KEY_ID"),
        secretAccessKey: required("BACKUP_SECRET_ACCESS_KEY")
      }
    })
  };
}

async function streamToBuffer(body) {
  if (!body) throw new Error("Backup object body is empty");
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function restoreValue(value) {
  if (value && typeof value === "object" && value.__type === "buffer" && value.base64) {
    return Buffer.from(value.base64, "base64");
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}

function quotedIdentifier(value) {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error(`Unsafe identifier: ${value}`);
  return `\`${value}\``;
}

async function resolveBackupKey(client, bucket) {
  if (process.env.BACKUP_KEY) return process.env.BACKUP_KEY;
  const latest = await client.send(new GetObjectCommand({ Bucket: bucket, Key: "mysql/latest.json" }));
  const body = await streamToBuffer(latest.Body);
  const manifest = JSON.parse(body.toString("utf8"));
  if (!manifest.key) throw new Error("mysql/latest.json does not contain a backup key");
  return manifest.key;
}

async function main() {
  if (process.env.RESTORE_CONFIRM !== "ACADEMY_RESTORE_DRILL") {
    throw new Error("RESTORE_CONFIRM=ACADEMY_RESTORE_DRILL is required");
  }

  const restoreDatabase = process.env.RESTORE_DATABASE || "hangdoi_academy_restore_drill";
  if (!/^hangdoi_academy_restore_[a-z0-9_]+$/.test(restoreDatabase)) {
    throw new Error("RESTORE_DATABASE must start with hangdoi_academy_restore_");
  }

  const { client, bucket } = s3Config();
  const key = await resolveBackupKey(client, bucket);
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const compressed = await streamToBuffer(object.Body);
  const sha256 = crypto.createHash("sha256").update(compressed).digest("hex");
  const expected = object.Metadata?.sha256;
  if (expected && expected !== sha256) {
    throw new Error(`Checksum mismatch for ${key}`);
  }

  const snapshot = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
  if (snapshot.format !== "hangdoi-academy-mysql-backup" || snapshot.version !== 1) {
    throw new Error("Unsupported backup format");
  }

  const sourceUrl = new URL(required("MYSQL_URL"));
  sourceUrl.pathname = "/";
  const connection = await mysql.createConnection({
    uri: sourceUrl.toString(),
    timezone: "Z",
    charset: "utf8mb4"
  });

  const db = quotedIdentifier(restoreDatabase);
  try {
    await connection.query(`DROP DATABASE IF EXISTS ${db}`);
    await connection.query(`CREATE DATABASE ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${db}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=0");

    for (const table of snapshot.tables || []) {
      quotedIdentifier(table.name);
      if (!table.createSql) throw new Error(`Missing CREATE TABLE for ${table.name}`);
      await connection.query(table.createSql);
    }

    for (const table of snapshot.tables || []) {
      const name = quotedIdentifier(table.name);
      const rows = Array.isArray(table.rows) ? table.rows : [];
      if (!rows.length) continue;

      const columns = Object.keys(rows[0]);
      const columnSql = columns.map(quotedIdentifier).join(", ");
      const batchSize = 200;

      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const placeholders = batch.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
        const values = batch.flatMap(row => columns.map(column => restoreValue(row[column])));
        await connection.query(
          `INSERT INTO ${name} (${columnSql}) VALUES ${placeholders}`,
          values
        );
      }
    }

    await connection.query("SET FOREIGN_KEY_CHECKS=1");

    const verified = {};
    for (const table of snapshot.tables || []) {
      const name = quotedIdentifier(table.name);
      const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM ${name}`);
      const actual = Number(row.count || 0);
      const expectedCount = Number(table.rowCount || 0);
      if (actual !== expectedCount) {
        throw new Error(`Row count mismatch for ${table.name}: expected ${expectedCount}, got ${actual}`);
      }
      verified[table.name] = actual;
    }

    console.log("[mysql-restore] verified", JSON.stringify({
      key,
      restoreDatabase,
      sha256,
      tableCount: snapshot.tables?.length || 0,
      rowCounts: verified
    }));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[mysql-restore] failed", error?.message || error);
  process.exit(1);
});
