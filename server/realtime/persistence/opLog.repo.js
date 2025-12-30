const prisma = require('../../config/prisma.js');

async function append(documentId, entry) {
  const op = entry.op;

  if (!op.opId || !op.clientId || typeof op.baseVersion !== 'number') {
    throw new Error("REBASER_RETURNED_INVALID_OP");
  }

  return prisma.operationLog.create({
    data: {
      documentId,
      version: entry.version,
      op: JSON.stringify(op)
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
