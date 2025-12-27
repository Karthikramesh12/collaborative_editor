const snapshotRepo = require('../persistence/snapshot.repo.js');
const documentStore = require('../memory/document.store.js');
const documentState = require('./document.state.js');

const SNAP_INTERVAL = 1000;

async function maybeSnapShot(doc) {
    if (doc.version % SNAP_INTERVAL !== 0) {
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
    if (!snap) {
        doc = documentStore.createDocument(documentId, "");
    } else {
        doc = documentStore.createDocument(documentId, snap.content);
        doc.version = snap.version;
    }
    return doc;
}

module.exports = {
    maybeSnapShot,
    loadOrCreate
}