class Dedup {
  constructor(limit = 5000) {
    this.limit = limit;
    this.map = new Map();
    this.queue = []; // Keep track of insertion order
  }

  hasSeen(id) {
    return this.map.has(id);
  }

  mark(id) {
    if (this.map.has(id)) {
      // Update timestamp if already exists
      this.map.set(id, Date.now());
      return;
    }

    // Add new ID
    this.map.set(id, Date.now());
    this.queue.push(id);

    // Enforce limit
    if (this.queue.length > this.limit) {
      const oldestId = this.queue.shift();
      this.map.delete(oldestId);
    }
  }

  // Optional: Clean up old entries
  cleanup(maxAgeMs = 3600000) { // 1 hour default
    const now = Date.now();
    const toDelete = [];
    
    for (const [id, timestamp] of this.map.entries()) {
      if (now - timestamp > maxAgeMs) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => {
      this.map.delete(id);
      const index = this.queue.indexOf(id);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
    });
  }
}

module.exports = Dedup;