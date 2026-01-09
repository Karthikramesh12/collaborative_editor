const CollabEngine = require('../../../engine/collab.engin.js');
const SnapShotManager = require('../../../engine/snapshot.manager.js');
const Operation = require('../../../engine/operation.state.js');
const { validate } = require('../../../engine/operations.js');

async function submitOperation(documentId, body){
    try{
        validate(body)
    } catch (error){
        throw new Error("INVALID_OP");
    }

    const op = new Operation(body);

    const doc = await SnapShotManager.loadOrCreate(documentId);

    const result = await CollabEngine.submitOperation(documentId, op);

    await SnapShotManager.maybeSnapShot(doc);

    return result;
}

async function getSnapShot(documentId) {
    const doc = await SnapShotManager.loadOrCreate(documentId);
    return doc.getSnapShot();
}

module.exports = {
    submitOperation,
    getSnapShot,
}