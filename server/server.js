const http = require("http");
const app = require("./app");
const prisma = require("./config/prisma.js");
const { attach } = require("./realtime/gateway/WebSockect/ws.gateway.js");
const registry = require("./realtime/sessions/client.registry.js");

registry.registerSystemClient("__fs__");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, async () => {
  console.log("Server running on port", PORT);

  const workspaces = await prisma.workspace.findMany();

  // LAST. Must be last. Do not move this.
  attach(server);
});
