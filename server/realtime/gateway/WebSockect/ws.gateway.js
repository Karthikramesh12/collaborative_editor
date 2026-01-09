const WebSocket = require("ws");
const controller = require("./ws.controller");

function attach(server) {
  const wss = new WebSocket.Server({ server });
  console.log("WebSocket gateway attached");   // ADD THIS
  wss.on("connection", controller.handleConnection);
}


module.exports = { attach };
