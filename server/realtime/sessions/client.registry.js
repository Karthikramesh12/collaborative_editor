const Client = new Map();

const HEARTBEAT_TIMEOUT = 15000;
const BySocket = new Map();

function register(ws, { clientId, documentId, lastSeenVersion }) {
  const meta = {
    clientId,
    ws,
    documentId,
    lastSeenVersion,
    lastSeenHeartBeat: Date.now(),
    connectedAt: Date.now(),
    pending: true,
    live: false
  };

  Client.set(clientId, meta);
  BySocket.set(ws, meta);

  ws.on("pong", () => {
    const c = Client.get(clientId);
    if (c) c.lastSeenHeartBeat = Date.now();
  });
}

function markPending(id) {
  const c = Client.get(id);
  if (c) {
    c.pending = true;
    c.live = false;
  }
}

function markLive(id) {
  const c = Client.get(id);
  if (c) {
    c.pending = false;
    c.live = true;
  }
}

function isLive(id) {
  return Client.get(id)?.live === true;
}

function touch(id) {
  const c = Client.get(id);
  if (c) c.lastSeenHeartBeat = Date.now();
}

function updateVersion(id, version) {
  const c = Client.get(id);
  if (c) c.lastSeenVersion = version;
}

function unRegister(id) {
  const c = Client.get(id);
  if (c) BySocket.delete(c.ws);
  Client.delete(id);
}

function reapDeadClients() {
  const now = Date.now();
  for (const [id, c] of Client) {
    if (now - c.lastSeenHeartBeat > HEARTBEAT_TIMEOUT) {
      try { c.ws.terminate(); } catch {}
      Client.delete(id);
    }
  }
}

function getBySocket(ws) {
  return BySocket.get(ws) || null;
}

setInterval(reapDeadClients, 5000);

function pingAll() {
  for (const c of Client.values()) {
    try { c.ws.ping(); } catch {}
  }
}

setInterval(pingAll, 5000);

module.exports = {
  register,
  markPending,
  markLive,
  isLive,
  touch,
  updateVersion,
  unRegister,
  getBySocket,
  get: id => Client.get(id) || null
};
