const prisma = require('../../config/prisma.js');

async function append(documentId, entry) {
  return prisma.operationLog.create({
    data: {
      documentId,
      version: entry.version,
      op: JSON.stringify(entry.op)
    }
  });
}


async function since(documentId, version) {
  return prisma.operationLog.findMany({
    where: { documentId, version: { gt: version } },
    orderBy: { version: 'asc' }
  });
}

module.exports = { append, since };
