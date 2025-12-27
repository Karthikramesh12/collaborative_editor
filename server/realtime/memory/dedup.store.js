class Dedup {
  constructor() {
    this.seen = new Set();
  }
  markSeen(id){ this.seen.add(id); }
  hasSeen(id){ return this.seen.has(id); }
}

module.exports = Dedup;
