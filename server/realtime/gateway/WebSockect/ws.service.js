const CollabEngine = require('../../engine/collab.engin.js');
const SnapShotManager = require('../../engine/snapshot.manager.js');

async function loadDocument(documentId){
    return SnapShotManager.loadOrCreate(documentId);
}

async function submit(documentId, op){
    return CollabEngine.submitOperation(documentId, op);
}

module.exports = { 
    loadDocument,
    submit
}