const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "reorder-doc";
const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);

ws.on("open", () => {
  // Force stale ops on purpose
  send(0, "[1]");
  send(0, "[2]");
  send(0, "[3]");
  send(0, "[4]");
  send(0, "[5]");
});

function send(base, text) {
  ws.send(JSON.stringify({
    type: "op",
    op: {
      operationId: randomUUID(),
      baseServerSeq: base,   // ALWAYS 0 — intentionally stale
      type: "insert",
      pos: 0,
      text
    }
  }));
}
