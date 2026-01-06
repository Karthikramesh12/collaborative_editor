const prisma = require('../../config/prisma.js');
const FileState = require('../engine/file.state.js');

const fileStore = new Map();
const IDLE_TTL = 1000 * 60 * 10;

// Load file state from snapshot + oplogs
async function loadFromDB(fileId) {
  const latestSnap = await prisma.fileSnapshot.findFirst({
    where: { fileId },
    orderBy: { version: 'desc' }
  });

  let baseVersion = 0;
  let file;

  if (!latestSnap) {
    file = new FileState(fileId, "");
  } else {
    file = new FileState(fileId, latestSnap.content);
    file.version = latestSnap.version;
    baseVersion = latestSnap.version;
  }

  const oplogs = await prisma.fileOplogs.findMany({
    where: { fileId, version: { gt: baseVersion } },
    orderBy: { version: 'asc' }
  });

  for (const row of oplogs) {
    file.apply(JSON.parse(row.op));
  }

  return file;
}

async function getFile(fileId) {
  let f = fileStore.get(fileId);
  if (f) {
    f.lastTouched = Date.now();
    return f;
  }

  f = await loadFromDB(fileId);
  if (!f) return null;

  fileStore.set(fileId, f);
  return f;
}

function hasFile(fileId) {
  return fileStore.has(fileId);
}

// No persistContent — snapshots handle durability
setInterval(async () => {
  for (const [id, file] of fileStore.entries()) {
    if (Date.now() - file.lastTouched > IDLE_TTL) {
      fileStore.delete(id);
    }
  }
}, 60_000);

module.exports = {
  getFile,
  hasFile
};
