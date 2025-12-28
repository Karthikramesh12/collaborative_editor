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

  if (!room || room.size === 0) {
    console.log("[BROADCAST] Room empty:", docId);
    return 0;
  }

  const data = JSON.stringify(msg);
  let delivered = 0;

  for (const ws of room) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
      delivered++;
    }
  }

  console.log("[BROADCAST] Delivered to", delivered, "clients");
  return delivered;
}


module.exports = {
    join,
    leave, 
    broadCast
}