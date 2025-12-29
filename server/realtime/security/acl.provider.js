const { getACL } = require('../../models/document.acl.js');

const cache = new Map();

async function loadACL(docId) {
    const acl = await getACL(docId);
    if(!acl){
        throw new Error("DOC_NOT_FOUND");
    }
    cache.set(docId, acl);
    return acl;
}

async function get(docId) {
    return cache.get(docId) || await loadACL(docId);
}

async function canWrite(docId, userId){
    const acl = await get(docId);
    return acl.writers.has(userId);
}

async function canRead(docId, userId){
    const acl = await get(docId);
    return acl.readers.has(userId);
}


function invalidate(docId){
    cache.delete(docId);
}

module.exports = { canWrite, canRead, invalidate };