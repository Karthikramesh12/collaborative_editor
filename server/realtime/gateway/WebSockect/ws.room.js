const rooms = new Map();

function join(docId, ws){
    if (!rooms.has(docId)){
        rooms.set(docId, new Set());
    }
    rooms.get(docId).add(ws);
}

function leave(docId, ws){
    rooms.get(docId)?.delete(ws);
    if (rooms.get(docId)?.size === 0){
        rooms.delete(docId);
    }
}

function broadCast(docId, msg) {
  const room = rooms.get(docId);
  if (!room || room.size === 0) return;

  const data = JSON.stringify(msg);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}



module.exports = {
    join,
    leave, 
    broadCast
}