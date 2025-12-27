const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "dup-doc";

const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);

let base = 0;
let sent = false;

ws.on("message", raw => {
  const msg = JSON.parse(raw.toString());

  if (msg.type === "snapshot") {
    base = msg.snapshot.version;
    fire();
  }

  if (msg.type === "op") {
    console.log("SERVER APPLIED:", msg.data.op.text, "version", msg.data.version);
  }
});

function fire() {
  if (sent) return;
  sent = true;

  const opId = randomUUID();

  const op = {
    operationId: opId,
    baseVersion: base,
    type: "insert",
    pos: 0,
    text: "[DUP]"
  };

  console.log("SENDING FIRST OP");
  ws.send(JSON.stringify({ type: "op", op }));

  setTimeout(() => {
    console.log("SENDING DUPLICATE OP (same operationId)");
    ws.send(JSON.stringify({ type: "op", op }));
  }, 200);

  setTimeout(() => {
    console.log("SENDING DUPLICATE AGAIN");
    ws.send(JSON.stringify({ type: "op", op }));
  }, 400);
}
