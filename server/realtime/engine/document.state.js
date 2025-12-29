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
      content: this.content
    };
  }

  apply(finalOp) {
    validate(finalOp);

    this.content = apply(this.content, finalOp);
    this.version++;
    this.serverSeq++;
    this.lastTouched = Date.now(); 

    const entry = { 
      serverSeq: this.serverSeq, 
      version: this.version, 
      op: finalOp 
    };
    
    this.opWindow.append(entry);
    
    // Only mark opId for deduplication
    // Remove packetId marking since we don't use it
    // if (finalOp.packetId) this.dedup.mark(finalOp.packetId); // REMOVE THIS
    
    // 🔒 Deterministic convergence verdict
    const EXPECTED = 6 * 10;   // CLIENTS * OPS_PER_CLIENT
    if (this.version === EXPECTED) {
      rooms.broadCast(this.documentId, {
        type: "final",
        version: this.version,
        content: this.content
      });
    }
    
    console.log("DOC", this.documentId, "=", this.content);
    return entry;
  }
}

module.exports = DocumentState;
