const { spawnSync } = require("child_process");
const fs = require("fs");

const servers = new Map();

function allocatePort() {
  const base = 41000;
  const max = 42000;
  for (let p = base; p <= max; p++) {
    if (![...servers.values()].some(s => s.port === p)) return p;
  }
  throw new Error("NO_FREE_VSCODE_PORTS");
}

async function ensureVscode(workspaceId, mountPath) {
  if (servers.has(workspaceId)) return servers.get(workspaceId);

  if (!fs.existsSync(mountPath)) fs.mkdirSync(mountPath, { recursive: true });
  if (!fs.existsSync(mountPath + "/.meta")) fs.mkdirSync(mountPath + "/.meta");

  const port = allocatePort();
  const container = `ws_${workspaceId}`;

  // kill old ghost container if any
  spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });

  const result = spawnSync("docker", [
    "run", "-d", "--rm",
    "--name", container,
    "-p", `${port}:8080`,
    "-v", `${mountPath}:/workspace`,
    "codercom/code-server:latest",
    "code-server",
    "--auth", "none",
    "--user-data-dir", "/workspace/.meta",
    "/workspace/files"
  ], { stdio: "inherit" });

  if (result.status !== 0) {
    throw new Error("FAILED_TO_START_VSCODE_CONTAINER");
  }

  const server = { workspaceId, port, container };
  servers.set(workspaceId, server);
  return server;
}

function stopVsCode(workspaceId) {
  const s = servers.get(workspaceId);
  if (!s) return;
  spawnSync("docker", ["rm", "-f", s.container]);
  servers.delete(workspaceId);
}

module.exports = { ensureVscode, stopVsCode };
