import { createMySqlPool } from "./db-mysql.js";
import { runMysqlBackup } from "./backup-mysql.js";

const pool = createMySqlPool(process.env.MYSQL_URL);

runMysqlBackup(pool, { reason: "manual", force: true })
  .then((result) => {
    console.log("[mysql-backup] manual_complete", JSON.stringify(result));
  })
  .catch((error) => {
    console.error("[mysql-backup] manual_failed", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
