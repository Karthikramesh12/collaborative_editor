const { validate } = require('../engine/operations.js');

function gaurd(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error("INVALID_OP_OBJECT");
  }

  const op = {
  ...raw,
  opId: raw.opId,
  clientId: raw.clientId || raw.userId,
  baseServerSeq: raw.baseServerSeq ?? raw.baseVersion
};

if (typeof op.baseServerSeq !== "number") throw new Error("MISSING_BASE_VERSION");


  // Hard contract normalization
  if (!op.opId) throw new Error("MISSING_OPID");
  if (!op.clientId) throw new Error("MISSING_CLIENTID");
  if (typeof op.baseVersion !== "number") throw new Error("MISSING_BASE_VERSION");

  // Rewrite canonical fields so rest of engine sees only 1 protocol
  op.baseServerSeq = op.baseVersion;

  validate(op);

  if (typeof op.opId !== 'string') throw new Error("INVALID_OPID");
  if (typeof op.clientId !== 'string') throw new Error("INVALID_CLIENTID");

  if (op.pos > 500000) throw new Error("OP_POS_TOO_LARGE");
  if (op.text && op.text.length > 10000) throw new Error("OP_PAYLOAD_TOO_LARGE");

  return op;
}

module.exports = { gaurd };
