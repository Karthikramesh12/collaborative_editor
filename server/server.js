const http = require("http");
const app = require("./app");
const prisma = require("./config/prisma.js");
const { attach } = require("./realtime/gateway/WebSockect/ws.gateway.js");
const { materializeWorkspace } = require("./modules/workspace/workspace.bootstrap.js");
const registry = require("./realtime/sessions/client.registry.js");
const { watchWorkspace } = require("./modules/workspace/workspace.watcher.js");

registry.registerSystemClient("__fs__");

const server = http.createServer(app);

(async () => {
  const workspaces = await prisma.workspace.findMany();

  for (const ws of workspaces) {
    await materializeWorkspace(ws.id);
    watchWorkspace(ws.id);
  }

  attach(server);   // WebSocket AFTER filesystem is real
})();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
