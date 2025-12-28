const rooms = require('./ws.room.js');
const store = require('../../memory/document.store.js');
const engine = require('../../engine/collab.engin.js');
const registry = require('../../sessions/client.registry.js');
const { gaurd } = require('../../security/op.security.js');
const flow = require('../../sessions/client.flow.js');
const crypto = require('crypto');

function handleConnection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const documentId = url.searchParams.get('documentId');
  if (!documentId) return ws.close(1008);

  const doc = store.createDocument(documentId);
  rooms.join(documentId, ws);

  const clientId = crypto.randomUUID();

  registry.register(ws, {
    clientId,
    documentId,
    lastSeenVersion: doc.serverSeq
  });

  ws.send(JSON.stringify({ type: "clientId", clientId }));
  ws.send(JSON.stringify({ type: "snapshot", snapshot: doc.getSnapShot() }));

  ws.on("message", raw => {
  registry.touch(clientId);
  onMessage(ws, clientId, documentId, raw);
});

  ws.on("close", () => {
    flow.clear(clientId);
    registry.unRegister(clientId);
    rooms.leave(documentId, ws);
  });
}


async function onMessage(ws, clientId, documentId, raw) {
  let payload;
  try {
    payload = JSON.parse(raw.toString());
  } catch {
    return ws.close(1003, "BAD_JSON");
  }

  if (payload.type !== "op") return;

  let op;
  try {
    op = gaurd(payload.op);
  } catch {
    return ws.close(1007, "BAD_OP");
  }

  const meta = registry.get(clientId);
  if (!meta || op.clientId !== meta.clientId) {
    return ws.close(4001, "CLIENT_ID_SPOOF");
  }

  // Only now does flow control make sense
  if (!flow.canSend(clientId)) {
    return ws.close(4002, "FLOOD");
  }

  try {
    const result = await engine.submitOperation(documentId, op, clientId);
    if (!result) {
      flow.markAck(clientId);
      return;
    }

    registry.updateVersion(clientId, result.version);
    rooms.broadCast(documentId, { type: "op", data: result });
    ws.send(JSON.stringify({ type: "ack", version: result.version }));
    flow.markAck(clientId);
  } catch (err) {
    flow.markAck(clientId);

    if (err.message === "RESYNC_REQUIRED") {
      const doc = store.getDocument(documentId);
      ws.send(JSON.stringify({ type: "resync", snapshot: doc.getSnapShot() }));
      return ws.close(4000, "STALE_CLIENT");
    }

    ws.close(1011);
  }
}




module.exports = { handleConnection };
