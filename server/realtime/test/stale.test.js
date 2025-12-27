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

  ws.on("open", () => {
    ready = true;
  });

  ws.on("message", raw => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === "snapshot") base = msg.snapshot.version;
    if (msg.type === "ack") base = msg.version;

    if (msg.type === "resync") {
      console.log("STALE CLIENT RESYNCED:", id, "-> reset base to", msg.snapshot.version);
      base = msg.snapshot.version;
      sent = 0;                  // hard reset local timeline
    }
  });

  if (autoFire) {
    loop = setInterval(() => {
      if (!ready) return;
      if (sent >= OPS) return clearInterval(loop);

      sent++;

      const op = {
        operationId: randomUUID(),
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
  });

  return ws;
}

const clients = [];

// Spawn 19 live clients
for (let i = 0; i < CLIENTS - 1; i++) {
  clients.push(spawn(i));
}

// Spawn client 19 (will become stale)
const stale = spawn(19);
clients.push(stale);

// Kill stale client after some ops
setTimeout(() => {
  console.log("FORCING STALE CLIENT DISCONNECT");
  stale.close();
}, 400);

// Reconnect stale client AFTER window overflows
setTimeout(() => {
  console.log("RECONNECTING STALE CLIENT");
  spawn(19);
}, 2000);
