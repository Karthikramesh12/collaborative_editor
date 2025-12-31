const Queues = new Map();     // clientId -> [{ op, flushFn }]
const Active = new Set();    // clientId

function setDocument(clientId, documentId) {
  // Only for validation, no batching by doc
}

function clear(clientId) {
  Queues.delete(clientId);
  Active.delete(clientId);
}

async function push(clientId, op, flushFn) {
  if (!Queues.has(clientId)) Queues.set(clientId, []);
  const q = Queues.get(clientId);
  q.push({ op, flushFn });

  if (!Active.has(clientId)) drain(clientId);
}

async function drain(clientId) {
  const q = Queues.get(clientId);
  if (!q || !q.length) {
    Active.delete(clientId);
    return;
  }

  Active.add(clientId);
  const { op, flushFn } = q.shift();

  try {
    await flushFn(op);
  } catch (e) {
    console.error("FLUSH FAILED", e);
  }

  Active.delete(clientId);
  if (q.length) drain(clientId);
}

module.exports = { push, clear, setDocument };
