class OpWindow {
  constructor() {
    this.WINDOW_SIZE = 25;
    this.window = [];
    this.earliestSeq = 0;
    this.latestSeq = 0;
  }

  append(entry) {
    if (entry.serverSeq !== this.latestSeq + 1) throw new Error("OP_SEQ_VIOLATION");

    this.latestSeq = entry.serverSeq;
    this.window.push(entry);

    if (this.window.length > this.WINDOW_SIZE) {
      this.window.shift();
      this.earliestSeq = this.window[0].serverSeq;
    } else if (this.window.length === 1) {
      this.earliestSeq = entry.serverSeq;
    }
  }

  since(version) {
  if (version < this.earliestSeq - 1) return null;
  return this.window.filter(e => e.version > version);
}


}

module.exports = OpWindow;
