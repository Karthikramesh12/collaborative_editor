const fileSnapshotRepo = require('../persistence/fileSnapshot.repo.js');
const fileStore = require('../memory/file.store.js');
const fileOpLogRepo = require('../persistence/fileOpLog.repo.js');

const SNAP_INTERVAL = 100;

async function maybeSnapShot(file) {
  if (file.serverSeq % SNAP_INTERVAL !== 0) return;

  const frozen = file.clone();

  await fileSnapshotRepo.save({
    fileId: frozen.fileId,
    version: frozen.serverSeq,
    content: frozen.content
  });
}

async function loadOrCreate(fileId) {
  const snap = await fileSnapshotRepo.latest(fileId);

  let baseVersion = 0;
  let temp;

  if (!snap) {
    temp = new (require('./file.state.js'))(fileId, "");
  } else {
    temp = new (require('./file.state.js'))(fileId, snap.content);
    temp.version = snap.version;
    baseVersion = snap.version;
  }

  const oplogs = await fileOpLogRepo.since(fileId, baseVersion);

  for (const row of oplogs) {
    temp.apply(JSON.parse(row.op));
  }

  return fileStore.getFile(fileId);
}

module.exports = { maybeSnapShot, loadOrCreate };
