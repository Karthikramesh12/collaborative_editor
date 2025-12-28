const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const CLIENTS = 20;
const OPS = 40;
const DOC = "stress-doc";

function spawn(id, autoFire = true) {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let base = 0;
  let ready = false;
  let sent = 0;
  let loop = null;
  let clientId = null; // Track server-assigned clientId

  ws.on("message", raw => {
    const msg = JSON.parse(raw.toString());

    // Store the clientId when server assigns it
    if (msg.type === "clientId") {
      clientId = msg.clientId;
      console.log(`Client ${id} got ID: ${clientId.substring(0, 8)}...`);
    }
    
    if (msg.type === "snapshot") {
      base = msg.snapshot.version;
      console.log(`Client ${id} got snapshot, version: ${base}`);
      ready = true;
    }
    
    if (msg.type === "ack") base = msg.version;

    if (msg.type === "resync") {
      console.log("STALE CLIENT RESYNCED:", id, "-> reset base to", msg.snapshot.version);
      base = msg.snapshot.version;
      sent = 0; // hard reset local timeline
    }
  });

  if (autoFire) {
    loop = setInterval(() => {
      if (!ready) return;
      if (!clientId) return; // Wait for clientId
      if (sent >= OPS) {
        clearInterval(loop);
        console.log(`Client ${id} finished sending ${OPS} operations`);
        return;
      }

      sent++;

      const op = {
        opId: randomUUID(),
        clientId: clientId, // Use server-assigned clientId
        baseVersion: base,
        type: "insert",
        pos: 0,
        text: `[${id}:${sent}]`
      };

      ws.send(JSON.stringify({ type: "op", op }));

      console.log(
        "SEND",
        "client", id,
        "base", base,
        "pos", op.pos,
        "text", op.text
      );
    }, Math.random() * 80 + 20);
  }

  // kill sender loop on disconnect
  ws.on("close", () => {
    clearInterval(loop);
    console.log(`Client ${id} disconnected`);
  });

  return ws;
}

const clients = [];

console.log(`Spawning ${CLIENTS - 1} live clients...`);
// Spawn 19 live clients
for (let i = 0; i < CLIENTS - 1; i++) {
  clients.push(spawn(i));
}

// Spawn client 19 (will become stale)
console.log("Spawning stale client 19...");
const stale = spawn(19);
clients.push(stale);

// Kill stale client after some ops
setTimeout(() => {
  console.log("\nFORCING STALE CLIENT DISCONNECT");
  stale.close();
}, 400);

// Reconnect stale client AFTER window overflows
setTimeout(() => {
  console.log("\nRECONNECTING STALE CLIENT");
  spawn(19);
}, 2000);