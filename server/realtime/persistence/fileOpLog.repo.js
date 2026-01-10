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

async function seal(fileId) {
  await prisma.fileOplogs.updateMany({
    where: {
      fileId: fileId,
    },
    data:{
      sealed: true
    }
  });
}

module.exports = { append, since, seal };
