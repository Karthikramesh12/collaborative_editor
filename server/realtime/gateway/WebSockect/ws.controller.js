const rooms = require('./ws.room.js');
const store = require('../../memory/document.store.js');
const engine = require('../../engine/collab.engin.js');

function handleConnection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const documentId = url.searchParams.get('documentId');
  if (!documentId) return ws.close(1008);

  const doc = store.createDocument(documentId);
  rooms.join(documentId, ws);

  ws.send(JSON.stringify({ type: "snapshot", snapshot: doc.getSnapShot() }));
  ws.on("message", raw => onMessage(ws, documentId, raw));
  ws.on("close", () => rooms.leave(documentId, ws));
  
}

async function onMessage(ws, documentId, raw) {
  const payload = JSON.parse(raw.toString());
  if (payload.type !== "op") return;

  try {
    const result = await engine.submitOperation(documentId, payload.op);
    if (!result) return;
    rooms.broadCast(documentId, { type: "op", data: result });

ws.send(JSON.stringify({
  type: "ack",
  version: result.version
}));

  } catch (err) {
  if (err.message === "RESYNC_REQUIRED") {
  const doc = store.getDocument(documentId);

  ws.send(JSON.stringify({
    type: "resync",
    snapshot: doc.getSnapShot()
  }));

  ws.close(4000, "STALE_CLIENT");
  return;
}

  ws.close(1011);
}

}

module.exports = { handleConnection };
