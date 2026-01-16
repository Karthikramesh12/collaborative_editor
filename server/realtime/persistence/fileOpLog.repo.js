const prisma = require('../../config/prisma.js');

async function append(fileId, entry) {
  return prisma.fileOpLog.create({
    data: {
      fileId,
      serverSeq: entry.serverSeq,
      op: JSON.stringify(entry.op)
    }
  });
}

async function since(fileId, serverSeq) {
  return prisma.fileOpLog.findMany({
    where: { fileId, serverSeq: { gt: serverSeq } },
    orderBy: { serverSeq: 'asc' }
  });
}

async function seal(fileId) {
  await prisma.fileOpLog.updateMany({
    where: {
      fileId: fileId,
    },
    data:{
      sealed: true
    }
  });
}

module.exports = { append, since, seal };
