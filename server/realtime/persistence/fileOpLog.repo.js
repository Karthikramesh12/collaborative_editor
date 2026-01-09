const prisma = require('../../config/prisma.js');

async function append(fileId, entry) {
  return prisma.fileOplogs.create({
    data: {
      fileId,
      serverSeq: entry.serverSeq,
      op: JSON.stringify(entry.op)
    }
  });
}

async function since(fileId, serverSeq) {
  return prisma.fileOplogs.findMany({
    where: { fileId, serverSeq: { gt: serverSeq } },
    orderBy: { serverSeq: 'asc' }
  });
}

module.exports = { append, since };
