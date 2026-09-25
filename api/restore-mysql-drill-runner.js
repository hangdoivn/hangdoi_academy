import http from "node:http";
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["restore-mysql-backup.js"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error("[mysql-restore-runner] spawn_failed", error?.message || error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (code !== 0) {
    console.error("[mysql-restore-runner] drill_failed", { code, signal });
    process.exit(code || 1);
    return;
  }

  const port = Number(process.env.PORT || 3000);
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, drill: "verified" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, "0.0.0.0", () => {
    console.log("[mysql-restore-runner] ready", { port });
  });
});
