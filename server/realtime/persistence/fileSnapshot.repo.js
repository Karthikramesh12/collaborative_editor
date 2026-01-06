const prisma = require('../../config/prisma.js');

async function save({ fileId, version, content }) {
  return prisma.fileSnapshot.create({
    data: { fileId, version, content }
  });
}

async function latest(fileId) {
  return prisma.fileSnapshot.findFirst({
    where: { fileId },
    orderBy: { version: 'desc' }
  });
}

module.exports = { save, latest };
