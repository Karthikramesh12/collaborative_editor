const snapshotRepo = require('../persistence/snapshot.repo.js');
const documentStore = require('../memory/document.store.js');
const opLogRepo = require('../persistence/opLog.repo.js');

const SNAP_INTERVAL = 100;

async function maybeSnapShot(doc) {
  if (doc.serverSeq % SNAP_INTERVAL !== 0) return;

  const frozen = doc.clone(); // deep copy, not reference

  await snapshotRepo.save({
    documentId: frozen.documentId,
    version: frozen.serverSeq,
    content: frozen.content
  });
}


async function loadOrCreate(documentId) {
  const snap = await snapshotRepo.latest(documentId);

  let baseVersion = 0;
  let tempDoc;

  if (!snap) {
    tempDoc = documentStore.createTempDocument("");
  } else {
    tempDoc = documentStore.createTempDocument(snap.content);
    tempDoc.version = snap.version;
    baseVersion = snap.version;
  }

  const oplogs = await opLogRepo.since(documentId, baseVersion);

  for (const row of oplogs) {
    tempDoc.apply(JSON.parse(row.op), true);
  }

  return documentStore.hydrateLive(tempDoc);
}

module.exports = { maybeSnapShot, loadOrCreate };
