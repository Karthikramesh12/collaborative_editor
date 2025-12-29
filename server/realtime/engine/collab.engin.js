const store = require('../memory/document.store.js');
const Rebase = require('./rebase.js');
const registry = require('../sessions/client.registry.js');
const Cursor = require('../sessions/presence.registry.js');
const { rebaseCursor } = require('./cursor.rebase.js');
const opLogRepo = require('../persistence/opLog.repo.js');
const snapper = require('./snapshot.manager.js');

class CollabEngine {
  async submitOperation(documentId, op, clientId) {
    const doc = await store.getDocument(documentId);
    if (!doc) throw new Error("DOCUMENT_NOT_LOADED");

    const client = registry.get(clientId);
    if (!client) throw new Error("GHOST_CLIENT");

    if (typeof op.baseVersion !== "number") {
      throw new Error("MISSING_BASE_VERSION");
    }
    
    const serverGap = doc.serverSeq - op.baseVersion;

    if (!op.opId) throw new Error("MISSING_OPID");

    // ====== FIXED DEDUPLICATION ======
    // Check for duplicate opId (not packetId)
    if (doc.dedup.hasSeen(op.opId)) {
      console.log(`[DEDUP] Skipping duplicate operation: ${op.opId}`);
      return null; // Return null to indicate duplicate
    }
    // ================================

    // Hard stale fence
    if (serverGap > doc.opWindow.WINDOW_SIZE) {
      throw new Error("RESYNC_REQUIRED");
    }

    let finalOp = op;

    if (serverGap > 0) {
      console.log("REBASING", op.opId, "gap", serverGap);
      const recent = doc.opWindow.since(op.baseVersion);
      if (!recent) throw new Error("RESYNC_REQUIRED");
      finalOp = Rebase.rebase(op, recent.map(e => e.op));
    } else {
      console.log("DIRECT APPLY", op.opId);
    }

    const applied = doc.apply(finalOp);
    await opLogRepo.append(documentId, {
  newServerSequence: doc.serverSeq,
  newVersion: doc.version,
  op: applied
});

await snapper.maybeSnapShot(doc);
    const cursors = Cursor.all(documentId);
    for (const c of cursors){
      c.pos = rebaseCursor(c.pos, finalOp);
      c.lastSeen = Date.now();
      Cursor.set(c.clientId, c);
    }
    console.log("APPLIED v", doc.serverSeq, "text", finalOp.text);

    // Mark opId as seen (not packetId)
    doc.dedup.mark(finalOp.opId);
    
    applied.opId = finalOp.opId;
    applied.clientId = finalOp.clientId || finalOp.userId;
    applied.baseVersion = finalOp.baseVersion;

    return applied;
  }
}

module.exports = new CollabEngine();