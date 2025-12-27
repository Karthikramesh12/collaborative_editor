const http = require("http");
const app = require("./app");
const { attach } = require("./realtime/gateway/WebSockect/ws.gateway.js");

const server = http.createServer(app);
attach(server);        // ← THIS WAS MISSING

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
