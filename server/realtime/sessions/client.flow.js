const MAX_INFLIGHT = 32;
const Inflight = new Map();

function canSend(clientId) {
  return (Inflight.get(clientId) || 0) < MAX_INFLIGHT;
}

function markSend(clientId) {
  Inflight.set(clientId, (Inflight.get(clientId) || 0) + 1);
}

function markAck(clientId) {
  const v = Inflight.get(clientId) || 0;
  if (v <= 1) Inflight.delete(clientId);
  else Inflight.set(clientId, v - 1);
}

function clear(clientId) {
  Inflight.delete(clientId);
}

module.exports = { canSend, markSend, markAck, clear };
