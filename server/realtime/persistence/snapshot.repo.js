const prisma = require('../../config/prisma.js');

async function save({ documentId, version, content }) {
  return prisma.documentSnapShot.create({
    data: { documentId, version, content }
  });
}

async function latest(documentId) {
  return prisma.documentSnapShot.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' }
  });
}


module.exports = { save, latest };
