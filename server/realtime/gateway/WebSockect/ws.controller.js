const rooms = require('./ws.room.js');
const store = require('../../memory/document.store.js');
const engine = require('../../engine/collab.engin.js');
const registry = require('../../sessions/client.registry.js');
const { gaurd } = require('../../security/op.security.js');
const flow = require('../../sessions/client.flow.js');
const { push, clear, setDocument } = require('../../sessions/client.batch.js');
const Cursor = require('../../sessions/presence.registry.js');
const acl = require('../../security/acl.provider.js');

async function handleConnection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const documentId = url.searchParams.get('documentId');
  if (!documentId) return ws.close(1008);

  const clientId = url.searchParams.get("userId")?.trim();
  if (!clientId) return ws.close(4001, "NO_AUTH");

  let aclData;
  try {
    aclData = await acl.canRead(documentId, clientId);
  } catch (e) {
    return ws.close(4404, "DOC_NOT_FOUND");
  }

  if (!aclData) {
    return ws.close(4004, "READ_FORBIDDEN");
  }

  const doc = await store.getDocument(documentId);
  if (!doc) return ws.close(4404, "DOC_NOT_LOADED");

  setDocument(clientId, documentId);
  registry.register(ws, {
    clientId,
    documentId,
    lastSeenVersion: doc.serverSeq
  });

  ws.send(JSON.stringify({ type: "clientId", clientId }));
  ws.send(JSON.stringify({ type: "snapshot", snapshot: doc.getSnapShot() }));

  rooms.join(documentId, ws);
  registry.markPending(clientId);

  ws.on("message", raw => {
    registry.touch(clientId);
    onMessage(ws, clientId, documentId, raw);
  });

  ws.on("close", () => {
    flow.clear(clientId);
    clear(clientId);
    registry.unRegister(clientId);
    rooms.leave(documentId, ws);
    Cursor.remove(clientId);
  });
}

async function onMessage(ws, clientId, documentId, raw) {
  console.log(`\n[WS ${new Date().toISOString()}] Message from ${clientId.substring(0, 8)}`);
  console.log(`[WS] Raw message: ${raw.toString().substring(0, 100)}`);

  let payload;
  try {
    payload = JSON.parse(raw.toString());
    console.log(`[WS] Parsed payload type: ${payload.type}`);
  } catch (err) {
    console.error(`[WS] JSON parse error:`, err.message);
    return ws.close(1003, "BAD_JSON");
  }

  // Handle snapshot acknowledgement
  if (payload.type === "snapshotAck") {
    registry.markLive(clientId);
    return;
  }

  // Handle cursor updates
  if (payload.type === "cursor") {
    console.log(`[WS] Cursor update from ${clientId}: pos=${payload.pos}`);
    
    // Update cursor position
    Cursor.set(clientId, {
      documentId,
      pos: payload.pos,
      lastSeen: Date.now()
    });

    // Broadcast updated cursors to all clients
    const updatedCursors = Cursor.all(documentId);
    rooms.broadCast(documentId, {
      type: "cursors",
      cursors: updatedCursors.map(c => ({
        clientId: c.clientId,
        pos: c.pos,
        documentId: c.documentId
      }))
    });
    return;
  }

  // Handle operations
  if (payload.type !== "op") {
    console.log(`[WS] Unknown message type: ${payload.type}`);
    return;
  }

  console.log(`[WS] Operation payload:`, JSON.stringify(payload.op, null, 2));

  let op;
  try {
    console.log(`[WS] Calling guard...`);
    op = gaurd(payload.op);
    console.log(`[WS] Guard passed!`);
  } catch (err) {
    console.error(`[WS] Guard failed:`, err.message);
    console.error(`[WS] Error details:`, err);
    return ws.close(1007, "BAD_OP");
  }

  const meta = registry.get(clientId);
  console.log(`[WS] Client meta:`, meta);

  if (!meta || op.clientId !== meta.clientId) {
    console.error(`[WS] Client ID mismatch or no meta`);
    return ws.close(4001, "CLIENT_ID_SPOOF");
  }

  console.log(`[WS] Pushing operation to batch buffer for client ${clientId.substring(0, 8)}`);

  await push(clientId, op, async (singleOp) => {
    const realClientId = singleOp.clientId;

    const result = await engine.submitOperation(documentId, singleOp, realClientId);
    if (!result) return;

    registry.updateVersion(realClientId, result.version);

    // Get updated cursors after operation
    const updatedCursors = Cursor.all(documentId);

    // Broadcast operation with updated cursors
    rooms.broadCast(documentId, {
      type: "op",
      serverSeq: result.serverSeq,
      version: result.version,
      op: result.op,
      cursors: updatedCursors.map(c => ({
        clientId: c.clientId,
        pos: c.pos
      }))
    }, ws => {
      const meta = registry.getBySocket(ws);
      return meta && registry.isLive(meta.clientId);
    });

    // Send ack to the originating client
    const target = registry.get(realClientId);
    if (target) {
      target.ws.send(JSON.stringify({
        type: "ack",
        version: result.version,
        serverSeq: result.serverSeq,
        op: result.op
      }));
    }

    flow.markAck(realClientId);
  });
}

module.exports = { handleConnection };