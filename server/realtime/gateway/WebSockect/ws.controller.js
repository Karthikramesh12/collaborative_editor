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

  if (payload.type !== "op") {
    console.log(`[WS] Ignoring non-op message type: ${payload.type}`);
    return;
  }

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

  await push(clientId, op, async (batchedOps) => {
    console.log(`[BATCH ${clientId.substring(0, 8)}] Flushing ${batchedOps.length} operations`);
    // In your controller, inside the push() callback:
    console.log(`[BATCH ${clientId.substring(0, 8)}] Raw batched ops:`);
    batchedOps.forEach((op, i) => {
      console.log(`  [${i}] opId: ${op.opId.substring(0, 8)}, text: "${op.text}"`);
    });

    // Then run the dedup logic and log:
    console.log(`[BATCH-DEDUP] Checking ${batchedOps.length} ops...`);
    const seenOpIds = new Set();
    const uniqueOps = [];

    for (const op of batchedOps) {
      if (seenOpIds.has(op.opId)) {
        console.log(`[BATCH-DEDUP] DUPLICATE FOUND: ${op.opId.substring(0, 8)}`);
      } else {
        seenOpIds.add(op.opId);
        uniqueOps.push(op);
      }
    }
    console.log(`[BATCH-DEDUP] Result: ${uniqueOps.length} unique ops`);

    try {
      // ====== FIX 1: DEDUPLICATE BEFORE COMPRESSION ======
      const uniqueOps = [];
      const seenOpIds = new Set();
      let duplicateCount = 0;

      for (const op of batchedOps) {
        if (!seenOpIds.has(op.opId)) {
          seenOpIds.add(op.opId);
          uniqueOps.push(op);
        } else {
          console.log(`[BATCH-DEDUP] Skipping duplicate opId: ${op.opId.substring(0, 8)}...`);
          duplicateCount++;
        }
      }

      if (duplicateCount > 0) {
        console.log(`[BATCH-DEDUP] Removed ${duplicateCount} duplicates, processing ${uniqueOps.length} unique ops`);
      }

      // If all ops were duplicates, just ack and return
      if (uniqueOps.length === 0) {
        console.log(`[BATCH-DEDUP] All operations were duplicates, sending ack`);
        flow.markAck(clientId);
        ws.send(JSON.stringify({ type: "ack", version: "duplicate" }));
        return;
      }
      // ===================================================

      const compressedOp = compress(uniqueOps);
      console.log(`[BATCH] Compressed to:`, compressedOp);

      console.log(`[BATCH] Submitting to engine...`);
      const result = await engine.submitOperation(documentId, compressedOp, clientId);
      console.log(`[BATCH] Engine result:`, result);

      if (!result) {
        console.log(`[BATCH] Engine returned null/false`);
        flow.markAck(clientId);
        return;
      }

      registry.updateVersion(clientId, result.version);

      console.log(`[BROADCAST] Broadcasting to room...`);
      const broadcastResult = rooms.broadCast(documentId, {
        type: "op",
        data: result
      });

      console.log(`[BROADCAST] Result:`, broadcastResult);

      ws.send(JSON.stringify({ type: "ack", version: result.version }));
      flow.markAck(clientId);
      console.log(`[BATCH] Successfully processed batch`);

    } catch (err) {
      console.error(`[BATCH] Error:`, err.message);
      console.error(`[BATCH] Stack:`, err.stack);

      flow.markAck(clientId);
      if (err.message === "RESYNC_REQUIRED") {
        const doc = await store.getDocument(documentId);
        ws.send(JSON.stringify({ type: "resync", snapshot: doc.getSnapShot() }));
        clear(clientId);
        return ws.close(4000, "STALE_CLIENT");
      }

      ws.close(1011);
    }
  });
}

module.exports = { handleConnection };