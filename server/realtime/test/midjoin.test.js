const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const LIVE_CLIENTS = 8;
const OPS_PER_CLIENT = 60;
const DOC = "midjoin-doc";

function spawn(id, autoFire = true) {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let base = 0;
  let ready = false;

  ws.on("open", () => ready = true);

  ws.on("message", raw => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === "snapshot") base = msg.snapshot.version;
    if (msg.type === "ack") base = msg.version;
    if (msg.type === "resync") {
      console.log("RESYNC", id, "->", msg.snapshot.version);
      base = msg.snapshot.version;
    }
  });

  if (autoFire) {
    let sent = 0;
    const loop = setInterval(() => {
      if (!ready) return;
      if (sent >= OPS_PER_CLIENT) return clearInterval(loop);
      sent++;

      const text = `[${id}:${sent}]`;

      ws.send(JSON.stringify({
        type: "op",
        op: {
          operationId: randomUUID(),
          baseVersion: base,
          type: "insert",
          pos: 0,
          text
        }
      }));

      console.log("SEND", id, "base", base, "text", text);
    }, Math.random() * 120 + 30);
  }

  return ws;
}

/* ───────────────────────────────────────── */

console.log("SPAWNING INITIAL CLIENTS");

// Start 8 clients
for (let i = 0; i < LIVE_CLIENTS; i++) spawn(i);

// Join a new client mid-session
setTimeout(() => {
  console.log("\nMID-SESSION JOIN CLIENT 99\n");
  spawn(99);
}, 1200);
