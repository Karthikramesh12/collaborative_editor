const rooms = require('./ws.room.js');
const store = require('../../memory/file.store.js');
const engine = require('../../engine/collab.engin.js');
const registry = require('../../sessions/client.registry.js');
const { gaurd } = require('../../security/op.security.js');
const flow = require('../../sessions/client.flow.js');
const { push, clear, setDocument } = require('../../sessions/client.batch.js');
const Cursor = require('../../sessions/presence.registry.js');
const acl = require('../../security/acl.provider.js');

async function handleConnection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const fileId = url.searchParams.get('fileId');
  if (!fileId) return ws.close(1008);

  const clientId = url.searchParams.get("userId")?.trim();
  if (!clientId) return ws.close(4001, "NO_AUTH");

  let aclData;
  try {
    aclData = await acl.canRead(fileId, clientId);
  } catch {
    return ws.close(4404, "FILE_NOT_FOUND");
  }

  if (!aclData) return ws.close(4004, "READ_FORBIDDEN");

  const file = await store.getFile(fileId);
  if (!file) return ws.close(4404, "FILE_NOT_LOADED");

  setDocument(clientId, fileId);

  registry.register(ws, {
    clientId,
    fileId,
    lastSeenVersion: file.serverSeq
  });

  ws.send(JSON.stringify({ type: "clientId", clientId }));
  ws.send(JSON.stringify({ type: "snapshot", snapshot: file.getSnapShot() }));

  rooms.join(fileId, ws);
  registry.markPending(clientId);

  ws.on("message", raw => {
    registry.touch(clientId);
    onMessage(ws, clientId, fileId, raw);
  });

  ws.on("close", () => {
    flow.clear(clientId);
    clear(clientId);
    registry.unRegister(clientId);
    rooms.leave(fileId, ws);
    Cursor.remove(clientId);
  });
}


async function onMessage(ws, clientId, fileId, raw) {
  let payload;
  try { payload = JSON.parse(raw.toString()); }
  catch { return ws.close(1003, "BAD_JSON"); }

  if (payload.type === "snapshotAck") {
    registry.markLive(clientId);
    return;
  }

  if (payload.type === "cursor") {
    Cursor.set(clientId, { fileId, pos: payload.pos, lastSeen: Date.now() });

    const cursors = Cursor.all(fileId);
    rooms.broadCast(fileId, {
      type: "cursors",
      cursors: cursors.map(c => ({ clientId: c.clientId, pos: c.pos }))
    });
    return;
  }

  if (payload.type !== "op") return;

  let op;
  try { op = gaurd(payload.op); }
  catch { return ws.close(1007, "BAD_OP"); }

  const meta = registry.get(clientId);
  if (!meta || op.clientId !== meta.clientId)
    return ws.close(4001, "CLIENT_ID_SPOOF");

  await push(clientId, op, async (singleOp) => {
    const result = await engine.submitOperation(fileId, singleOp, singleOp.clientId);
    if (!result) return;

    registry.updateVersion(singleOp.clientId, result.version);

    const cursors = Cursor.all(fileId);

    rooms.broadCast(fileId, {
      type: "op",
      serverSeq: result.serverSeq,
      version: result.version,
      op: result.op,
      cursors: cursors.map(c => ({ clientId: c.clientId, pos: c.pos }))
    }, ws => {
      const meta = registry.getBySocket(ws);
      return meta && registry.isLive(meta.clientId);
    });

    const target = registry.get(singleOp.clientId);
    if (target) {
      target.ws.send(JSON.stringify({
        type: "ack",
        version: result.version,
        serverSeq: result.serverSeq,
        op: result.op
      }));
    }

    flow.markAck(singleOp.clientId);
  });
}

module.exports = { handleConnection };