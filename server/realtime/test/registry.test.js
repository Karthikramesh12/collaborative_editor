const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "stale-registry";

function client(name) {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let base = 0;

  ws.on("message", r => {
    const m = JSON.parse(r);
    if (m.type === "snapshot") base = m.snapshot.version;
    if (m.type === "ack") base = m.version;
    if (m.type === "resync") console.log("RESYNCED", name);
  });

  return {
    ws,
    send(txt) {
      ws.send(JSON.stringify({
        type: "op",
        op: {
          operationId: randomUUID(),
          baseVersion: base, // ignored by server now
          type: "insert",
          pos: 0,
          text: txt
        }
      }));
    }
  };
}

const A = client("A");
const B = client("B");

// A will advance document far beyond window
setTimeout(() => {
  for (let i = 0; i < 200; i++) {
    A.send("A" + i);
  }
}, 200);

// B stays idle and becomes stale
setTimeout(() => {
  console.log("B is stale and sending");
  B.send("B1");
}, 2000);
