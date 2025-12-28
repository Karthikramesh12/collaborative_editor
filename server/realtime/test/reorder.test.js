const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "reorder-doc";
const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);

let clientId = null;

ws.on("message", (r) => {
  const m = JSON.parse(r);
  
  // Store the clientId when server assigns it
  if (m.type === "clientId") {
    clientId = m.clientId;
    console.log(`Got clientId: ${clientId.substring(0, 8)}...`);
    
    // Start sending operations after we have clientId
    send(0, "[1]");
    send(0, "[2]");
    send(0, "[3]");
    send(0, "[4]");
    send(0, "[5]");
  }
  
  if (m.type === "snapshot") {
    console.log(`Got snapshot, version: ${m.snapshot.version}`);
  }
  
  if (m.type === "ack") {
    console.log(`Got ack, new version: ${m.version}`);
  }
  
  if (m.type === "resync") {
    console.log(`Got resync, snapshot version: ${m.snapshot.version}`);
  }
});

function send(base, text) {
  // Wait for clientId before sending
  if (!clientId) {
    console.log("Waiting for clientId...");
    return;
  }
  
  ws.send(JSON.stringify({
    type: "op",
    op: {
      opId: randomUUID(),
      clientId: clientId,          // Add clientId
      baseVersion: base,           // CORRECT FIELD NAME
      type: "insert",
      pos: 0,
      text
    }
  }));
  
  console.log(`Sent: ${text} with baseVersion: ${base}`);
}