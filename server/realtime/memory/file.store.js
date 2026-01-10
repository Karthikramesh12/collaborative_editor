const FileState = require('../engine/file.state.js');
const snapshotRepo = require('../persistence/fileSnapshot.repo.js');
const oplogRepo = require('../persistence/fileOpLog.repo.js');

const fileStore = new Map();
const IDLE_TTL = 1000 * 60 * 10;

async function rebuild(fileId) {
  const snap = await snapshotRepo.latest(fileId);

  let base = 0;
  let state;

  if (!snap) {
    state = new FileState(fileId, "");
  } else {
    state = new FileState(fileId, snap.content);
    state.version = snap.version;
    state.serverSeq = snap.version;
    base = snap.version;
  }

  const ops = await oplogRepo.since(fileId, base);
  for (const row of ops) {
    state.apply(typeof row.op === "string" ? JSON.parse(row.op) : row.op);
  }

  return state;
}

async function getFile(fileId) {
  let f = fileStore.get(fileId);
  if (f) {
    f.lastTouched = Date.now();
    return f;
  }

  f = await rebuild(fileId);
  if (!f) return null;

  fileStore.set(fileId, f);
  return f;
}

function setFile(fileId, state) {
  state.lastTouched = Date.now();
  fileStore.set(fileId, state);
}

function dropFile(fileId){
  fileStore.delete(fileId);
}

setInterval(() => {
  for (const [id, f] of fileStore.entries()) {
    if (Date.now() - f.lastTouched > IDLE_TTL) {
      fileStore.delete(id);
    }
  }
}, 60_000);

module.exports = { getFile, setFile, dropFile };
