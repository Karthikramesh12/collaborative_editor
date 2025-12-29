const Cursor = new Map();
const CURSOR_TTL = 1000 * 60 * 2;

function set(clientId, cursor){
    Cursor.set(clientId, cursor)
}

function get(clientId){
    return Cursor.get(clientId);
}

function all(docId){
    return [...Cursor.entries()]
    .filter(([,c]) => c.documentId === docId)
    .map(([id, c]) => ({clientId: id, pos: c.pos}));
}

function remove(clientId){
    Cursor.delete(clientId);
}

setInterval(()=>{
    for(const [id, c] of Cursor.entries()){
        if(Date.now() - c.lastSeen > CURSOR_TTL){
            Cursor.delete(id);
        }
    }
}, 30_000);

module.exports = { set, get, all, remove };