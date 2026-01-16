const store = require('../memory/file.store.js');
const Rebase = require('./rebase.js');
const registry = require('../sessions/client.registry.js');
const Cursor = require('../sessions/presence.registry.js');
const { rebaseCursor } = require('./cursor.rebase.js');
const opLogRepo = require('../persistence/fileOpLog.repo.js');
const snapper = require('./fileSnapshot.manager.js');
const snapShot = require('../persistence/fileSnapshot.repo.js');
const { persistToDisk } = require("../fs/file.disk.js");
const DiffMatchPatch = require("diff-match-patch");
const dump = new DiffMatchPatch();
const { gaurd } = require("../security/op.security.js");
const ACL = require("../security/acl.provider.js");
const { randomUUID } = require("crypto");

class CollabEngine {
  async submitOperation(documentId, op, clientId) {
    const doc = await store.getFile(documentId);
    if (!doc) throw new Error("DOCUMENT_NOT_LOADED");

    let client = registry.get(clientId);

if (!client) {
  // virtual system client (fs, migrations, snapshots, etc.)
  client = {
    clientId,
    ws: null,
    system: true
  };
}

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
    // await store.persistDocument(documentId);

    // 5 — PERSISTENCE
    await opLogRepo.append(documentId, {
      serverSeq: entry.serverSeq,
      version: entry.version,
      op: entry.op
    });

    await snapper.maybeSnapShot(doc);

    // await persistToDisk(documentId, doc.content);

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

  async absorbFsContent(fileId, newText){
    const doc = await store.getFile(fileId);
    if (!doc){
      return;
    }

    const oldText = doc.content;
    if(oldText === newText){
      return;
    }

    const diffs = dump.diff_main(oldText, newText);
    dump.diff_cleanupEfficiency(diffs);

    let cursor = 0;

    for (const [type, data] of diffs){
      let raw;

      if (type === DiffMatchPatch.DIFF_EQUAL){
        cursor += data.length;
        continue;
      }

      if (type === DiffMatchPatch.DIFF_DELETE){
        raw = {
          opId: `fs-${randomUUID()}`,
          clientId: '__fs__',
          baseVersion: doc.serverSeq,
          type: "delete",
          pos: cursor,
          length: data.length
        };
      }

      if (type === DiffMatchPatch.DIFF_INSERT){
        raw = {
          opId: `fs-${randomUUID()}`,
          clientId: '__fs__',
          baseVersion: doc.serverSeq,
          type: "insert",
          pos: cursor,
          text: data
        };
        cursor += data.length;
      }

      if (!raw){
        continue;
      }

      const gaurded = gaurd(raw);

      const allowed = await ACL.canWrite(fileId, gaurded.clientId);
      if (!allowed){
        throw new Error("FS_WRITE_FORBIDDEN");
      }

      await this.submitOperation(fileId, gaurded, '__fs__');
    }
  }

  async dropFile(fileId){
    const doc = await store.getFile(fileId);

    if (!doc){
      return;
    }

    await snapper.forceSnapshot(doc);
    await opLogRepo.seal(fileId);
    store.dropFile(fileId);
    Cursor.dropAll(fileId);
  }
}

module.exports = new CollabEngine();
