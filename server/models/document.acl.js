const prisma = require('../config/prisma.js');

async function getACL(documentId){
    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { editors: true }
    });

    if (!doc) return null;

    const writers = new Set();
    const readers = new Set();

    // OWNER ALWAYS HAS FULL RIGHTS
    writers.add(doc.ownerId);
    readers.add(doc.ownerId);

    for (const e of doc.editors) {
        readers.add(e.userId);
        if (e.role !== 'VIEWER') writers.add(e.userId);
    }

    return { owner: doc.ownerId, writers, readers };
}


module.exports = { getACL }