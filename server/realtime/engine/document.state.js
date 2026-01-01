const OpWindow = require('../memory/op.window.js');
const Dedup = require('../memory/dedup.store.js');
const rooms = require('../gateway/WebSockect/ws.room.js');
const { apply, validate } = require('./operations.js');

class DocumentState {
  constructor(documentId, initialContent = "") {
    this.documentId = documentId;
    this.content = initialContent;
    this.version = 0;
    this.serverSeq = 0;
    this.opWindow = new OpWindow();
    this.dedup = new Dedup();
    this.lastTouched = Date.now();
  }

  getSnapShot() {
    return {
      documentId: this.documentId,
      version: this.version,
      serverSeq: this.serverSeq,
      content: this.content
    };
  }

  apply(finalOp) {
    validate(finalOp);

    this.content = apply(this.content, finalOp);
    this.version++;     // UI version only
    this.serverSeq++;   // authoritative ordering
    this.lastTouched = Date.now();

    const entry = {
      serverSeq: this.serverSeq,
      version: this.version,
      op: { ...finalOp, baseVersion: this.serverSeq - 1 }
    };

    this.opWindow.append(entry);
    return entry;
  }

  clone() {
  const c = new DocumentState(this.documentId, this.content);
  c.version = this.version;
  c.serverSeq = this.serverSeq;
  return c;
}
}

module.exports = DocumentState;
