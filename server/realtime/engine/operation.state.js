class Operation {
  constructor({ opId, clientId, baseServerSeq, type, pos, text, length }) {
    this.operationId = opId;
    this.clientId = clientId;
    this.baseServerSeq = baseServerSeq;
    this.type = type;
    this.pos = pos;
    this.text = text || null;
    this.length = length || null;
  }

  static insert({ opId, clientId, baseVersion, pos, text }) {
    return new Operation({ opId, clientId, baseVersion, type: "insert", pos, text });
  }

  static delete({ opId, clientId, baseVersion, pos, length }) {
    return new Operation({ opId, clientId, baseVersion, type: "delete", pos, length });
  }
}

module.exports = Operation;
