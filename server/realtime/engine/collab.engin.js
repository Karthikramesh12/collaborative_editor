const store = require('../memory/document.store.js');
const Rebase = require('./rebase.js');

class CollabEngine {
  async submitOperation(documentId, op) {
    const doc = store.getDocument(documentId);
    if (!doc) throw new Error("DOCUMENT_NOT_LOADED");

    if (doc.dedup.hasSeen(op.operationId)) return null;

    // STALE DETECTION (CORRECT)
    const gap = doc.version - op.baseVersion;
    if (gap < 0) throw new Error("FUTURE_VERSION");
    if (gap > doc.opWindow.WINDOW_SIZE) throw new Error("RESYNC_REQUIRED");

    let finalOp = op;

    if (gap > 0) {
      const recent = doc.opWindow.since(op.baseVersion);
      if (!recent) throw new Error("RESYNC_REQUIRED");
      finalOp = Rebase.rebase(op, recent.map(e => e.op));
    }

    return doc.apply(finalOp);
  }
}

module.exports = new CollabEngine();
