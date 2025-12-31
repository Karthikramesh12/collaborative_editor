const rooms = require('./ws.room.js');
const store = require('../../memory/document.store.js');
const engine = require('../../engine/collab.engin.js');
const registry = require('../../sessions/client.registry.js');
const { gaurd } = require('../../security/op.security.js');
const flow = require('../../sessions/client.flow.js');
const crypto = require('crypto');
const { push, clear, setDocument } = require('../../sessions/client.batch.js');
const { compress } = require('../../engine/op.compress.js');
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
    Cursor.set(clientId, { documentId, pos: 0, lastSeen: Date.now() });
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

  if (payload.type === "snapshotAck") {
  registry.markLive(clientId);
  return;
}

if (payload.type !== "op") return;


  console.log(`[WS] Operation payload:`, JSON.stringify(payload.op, null, 2));

  let op;
  try {
    console.log(`[WS] Calling guard...`);
    op = gaurd(payload.op);
    console.log(`[WS] Guard passed!`);
    // In onMessage(), after guard passes:
    // const doc = await store.getDocument(documentId);
    // if (doc && doc.dedup.hasSeen(op.opId)) {
    //   console.log(`[CONTROLLER-DEDUP] Skipping duplicate operation: ${op.opId.substring(0, 8)}...`);
    //   flow.markAck(clientId);
    //   ws.send(JSON.stringify({ type: "ack", version: "duplicate" }));
    //   return;  // Don't push to batch at all!
    // }
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

  if (!flow.canSend(clientId)) {
    console.error(`[WS] Flow control blocked client`);
    return ws.close(4002, "FLOOD");
  }

  console.log(`[WS] Pushing operation to batch buffer for client ${clientId.substring(0, 8)}`);

  await push(clientId, op, async (singleOp) => {
  const realClientId = singleOp.clientId;

  const result = await engine.submitOperation(documentId, singleOp, realClientId);
  if (!result) return;

  registry.updateVersion(realClientId, result.version);

  rooms.broadCast(documentId, {
    type: "op",
    serverSeq: result.serverSeq,
    version: result.version,
    op: result.op
  }, c => registry.isLive(c.clientId));

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