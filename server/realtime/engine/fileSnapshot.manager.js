const fileSnapshotRepo = require('../persistence/fileSnapshot.repo.js');
const fileStore = require('../memory/file.store.js');
const fileOpLogRepo = require('../persistence/fileOpLog.repo.js');
const Filestate = require('./file.state.js');
const { file } = require('../../config/prisma.js');

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

async function loadOrCreate(fileId){
  const snap = fileSnapshotRepo.latest(fileId);

  let baseVersion = 0;
  let temp;

  if (!snap){
    temp = new Filestate(fileId, "");
  } else{
    temp = new Filestate(fileId, snap.content);
    temp.version = snap.version;
    temp.serverSeq = snap.version;
    baseVersion = snap.version;
  }

  const oplog = await fileOpLogRepo.since(fileId, baseVersion);

  for(const row of oplog){
    temp.apply(typeof row.op === "string" ? JSON.parse(row.op) : row.op);
  } 

  fileStore.setFile(fileId, temp);

  return temp;
}

module.exports = { maybeSnapShot, loadOrCreate };
