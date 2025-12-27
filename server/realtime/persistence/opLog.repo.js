const prisma = require('../../config/prisma.js');

async function append(documentId, entry){
    return prisma.operationLog.create({
        data:{
            documentId,
            serverSeq: entry.newServerSequence,
            version: entry.newVersion,
            op: JSON.stringify(entry.op)
        }
    });
}

async function since(documentId, version){
    return prisma.operationLog.findMany({
        where: {documentId, version: { gt: version }},
        orderBy: { serverSeq: 'asc' }
    });
}

module.exports = { append, since };