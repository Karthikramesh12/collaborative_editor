const store = require('../memory/document.store.js');
const Rebase = require('./rebase.js');
const registry = require('../sessions/client.registry.js');
const Cursor = require('../sessions/presence.registry.js');
const { rebaseCursor } = require('./cursor.rebase.js');
const opLogRepo = require('../persistence/opLog.repo.js');
const snapper = require('./snapshot.manager.js');
const snapShot = require('../persistence/snapshot.repo.js');

class CollabEngine {
  async submitOperation(documentId, op, clientId) {
    const doc = await store.getDocument(documentId);
    if (!doc) throw new Error("DOCUMENT_NOT_LOADED");

    const client = registry.get(clientId);
    if (!client) throw new Error("GHOST_CLIENT");
    if (!op.opId) throw new Error("MISSING_OPID");

    // 1 — DEDUP GATE
    if (doc.dedup.hasSeen(op.opId)) return null;
    doc.dedup.mark(op.opId);

    // 2 — HARD STALE FENCE
    const earliest = doc.opWindow.earliestServerSeq();
    if (earliest !== null && op.baseVersion < earliest) {
      const snap = await snapShot.latest(documentId);
      client.ws.send(JSON.stringify({ type: "snapshot", snap }));
      return null;
    }

    // 3 — CAUSAL REBASE
    const recent = doc.opWindow.sinceServerSeq(op.baseVersion);
    const rebased = recent.length
      ? Rebase.rebase(op, recent.map(e => e.op))
      : op;

    if (!rebased ||
    !rebased.opId ||
    !rebased.clientId ||
    typeof rebased.baseVersion !== 'number') {
  throw new Error("REBASER_RETURNED_INVALID_OP");
}

    // 4 — COMMIT
    const entry = doc.apply(rebased);
    await store.persistDocument(documentId);

    // 5 — PERSISTENCE
    await opLogRepo.append(documentId, {
      serverSeq: entry.serverSeq,
      version: entry.version,
      op: entry.op
    });

    await snapper.maybeSnapShot(doc);

    // 6 — BROADCAST
    const cursors = Cursor.all(documentId);
    for (const c of cursors) {
      c.pos = rebaseCursor(c.pos, rebased);
      Cursor.set(c.clientId, c);
    }

    return {
      serverSeq: entry.serverSeq,
      version: entry.version,
      op: entry.op
    };
  }
}

module.exports = new CollabEngine();
