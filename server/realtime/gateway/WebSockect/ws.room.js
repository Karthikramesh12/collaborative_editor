const rooms = new Map();

function join(fileId, ws){
  if (!rooms.has(fileId)) rooms.set(fileId, new Set());
  rooms.get(fileId).add(ws);
}

function leave(fileId, ws){
  rooms.get(fileId)?.delete(ws);
  if (rooms.get(fileId)?.size === 0) rooms.delete(fileId);
}

function broadCast(fileId, msg, filter = () => true) {
  const room = rooms.get(fileId);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const ws of room) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (!filter(ws)) continue;
    ws.send(data);
  }
}

module.exports = { join, leave, broadCast };
