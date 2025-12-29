const snapshotRepo = require('../persistence/snapshot.repo.js');
const documentStore = require('../memory/document.store.js');
const documentState = require('./document.state.js');
const opLogRepo = require('../persistence/opLog.repo.js');

const SNAP_INTERVAL = 300;

async function maybeSnapShot(doc) {
    if (doc.serverSeq % SNAP_INTERVAL !== 0) {
        return;
    }

    await snapshotRepo.save({
        documentId: doc.documentId,
        version: doc.version,
        content: doc.content
    });
}

async function loadOrCreate(documentId) {
  const snap = await snapshotRepo.latest(documentId);

  let doc;
  let baseVersion = 0;

  if (!snap) {
    doc = documentStore.createDocument(documentId, "");
  } else {
    doc = documentStore.createDocument(documentId, snap.content);
    doc.version = snap.version;
    baseVersion = snap.version;
  }

  // REPLAY oplog after snapshot
  const oplogs = await opLogRepo.since(documentId, baseVersion);
  for (const row of oplogs) {
    const op = JSON.parse(row.op);
    doc.apply(op, true); // true = recovery mode, no rebasing, no dedup
    doc.serverSeq = row.serverSeq;
  }

  return doc;
}

module.exports = {
    maybeSnapShot,
    loadOrCreate
}