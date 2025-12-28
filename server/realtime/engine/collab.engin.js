const store = require('../memory/document.store.js');
const Rebase = require('./rebase.js');
const registry = require('../sessions/client.registry.js');

class CollabEngine {
  async submitOperation(documentId, op, clientId) {
    const doc = store.getDocument(documentId);
    if (!doc) throw new Error("DOCUMENT_NOT_LOADED");

    const client = registry.get(clientId);
    if (!client) throw new Error("GHOST_CLIENT");

    if (typeof op.baseVersion !== "number") {
  throw new Error("MISSING_BASE_VERSION");
}

const serverGap = doc.serverSeq - op.baseVersion;


    // Hard stale fence
    if (serverGap > doc.opWindow.WINDOW_SIZE) {
      throw new Error("RESYNC_REQUIRED");
    }

    // Dedup must be checked after stale gate
    if (doc.dedup.hasSeen(op.operationId)) {
      console.log("DEDUP IGNORE", op.operationId);
      return null;
    }

    let finalOp = op;

    if (serverGap > 0) {
      console.log("REBASING", op.operationId, "gap", serverGap);
      const recent = doc.opWindow.since(op.baseVersion);
      if (!recent) throw new Error("RESYNC_REQUIRED");
      finalOp = Rebase.rebase(op, recent.map(e => e.op));
    } else {
      console.log("DIRECT APPLY", op.operationId);
    }

    const result = doc.apply(finalOp);
    console.log("APPLIED v", doc.serverSeq, "text", finalOp.text);
    return result;
  }
}

module.exports = new CollabEngine();
