class OpWindow {
  constructor(limit = 200) {
    this.limit = limit;
    this.buffer = [];   // ordered by serverSeq asc
  }

  append(entry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.limit) this.buffer.shift();
  }

  sinceServerSeq(serverSeq) {
    return this.buffer.filter(e => e.serverSeq > serverSeq);
  }

  earliestServerSeq() {
    return this.buffer.length ? this.buffer[0].serverSeq : null;
  }
}

module.exports = OpWindow;
