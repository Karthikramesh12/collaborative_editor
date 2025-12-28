const Client = new Map();

const HEARTBEAT_TIMEOUT = 15000;

function register(ws, { clientId, documentId, lastSeenVersion }) {
  const meta = {
    clientId,
    ws,
    documentId,
    lastSeenVersion,
    lastSeenHeartBeat: Date.now(),
    connectedAt: Date.now()
  };

  Client.set(clientId, meta);

  // REAL TCP heartbeat — pong frame
  ws.on("pong", () => {
    const c = Client.get(clientId);
    if (c) c.lastSeenHeartBeat = Date.now();
  });
}

function touch(clientId) {
  const c = Client.get(clientId);
  if (c) c.lastSeenHeartBeat = Date.now();
}

function updateVersion(clientId, version) {
  const c = Client.get(clientId);
  if (c) c.lastSeenVersion = version;
}

function unRegister(clientId) {
  return Client.delete(clientId);
}

function reapDeadClients() {
  const now = Date.now();

  for (const [id, c] of Client) {
    if (now - c.lastSeenHeartBeat > HEARTBEAT_TIMEOUT) {
      console.log("TCP DEAD CLIENT REAPED", id);
      try { c.ws.terminate(); } catch {}
      Client.delete(id);
    }
  }
}

setInterval(reapDeadClients, 5000);

// REAL TCP ping frames
function pingAll() {
  for (const c of Client.values()) {
    try { c.ws.ping(); } catch {}
  }
}

setInterval(pingAll, 5000);

module.exports = {
  register,
  touch,
  updateVersion,
  unRegister,
  get: id => Client.get(id) || null
};
