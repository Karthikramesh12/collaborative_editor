const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "flood-test";

function makeClient() {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let ready = false;
  let clientId = null;
  let base = 0;

  ws.on("message", m => {
    const msg = JSON.parse(m);
    if (msg.type === "clientId") clientId = msg.clientId;
    if (msg.type === "snapshot") {
      base = msg.snapshot.version;
      ready = true;
    }
    if (msg.type === "ack") base = msg.version;
  });

  return {
    ws,
    flood() {
      if (!ready) return setTimeout(() => this.flood(), 50);
      console.log("B STARTS FLOOD ATTACK");
      for (let i = 0; i < 500; i++) {
        ws.send(JSON.stringify({
          type: "op",
          op: {
            opId: randomUUID(),
            clientId,
            baseServerSeq: base,
            type: "insert",
            pos: 0,
            text: "X"
          }
        }));
      }
    }
  };
}

const B = makeClient();
setTimeout(() => B.flood(), 500);
