const prisma = require('../../config/prisma.js');

async function save({ fileId, version, hash, content }) {
  return prisma.fileSnapShot.create({
    data: { fileId, version, hash, content }
  });
}

async function latest(fileId) {
  return prisma.fileSnapShot.findFirst({
    where: { fileId },
    orderBy: { version: 'desc' }
  });
}

module.exports = { save, latest };
