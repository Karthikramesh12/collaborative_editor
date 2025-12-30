const { validate } = require('../engine/operations.js');

function gaurd(raw) {
  if (!raw || typeof raw !== 'object') throw new Error("INVALID_OP_OBJECT");

  const op = {
    opId: raw.opId,
    clientId: raw.clientId || raw.userId,
    baseVersion: raw.baseVersion,
    type: raw.type,
    pos: raw.pos,
    text: raw.text,
    length: raw.length
  };

  // Canonical causal anchor
  if (typeof op.baseVersion !== "number") throw new Error("MISSING_BASE_VERSION");

  if (!op.opId) throw new Error("MISSING_OPID");
  if (!op.clientId) throw new Error("MISSING_CLIENTID");

  validate(op);

  if (typeof op.opId !== 'string') throw new Error("INVALID_OPID");
  if (typeof op.clientId !== 'string') throw new Error("INVALID_CLIENTID");

  if (op.pos > 500000) throw new Error("OP_POS_TOO_LARGE");
  if (op.text && op.text.length > 10000) throw new Error("OP_PAYLOAD_TOO_LARGE");

  return op;
}

module.exports = { gaurd };
