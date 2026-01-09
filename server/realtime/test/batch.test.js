// batch-with-dups.test.js
const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "batch-dup-test";

function makeClient(name) {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let ready = false;
  let clientId = null;
  let base = 0;
  let received = 0;
  let receivedOps = new Set(); // Track unique ops

  ws.on("message", m => {
    const msg = JSON.parse(m);
    if (msg.type === "clientId") clientId = msg.clientId;
    if (msg.type === "snapshot") { 
      base = msg.snapshot.version; 
      ready = true; 
    }
    if (msg.type === "op") {
      received++;
      if (msg.data?.opId) {
        receivedOps.add(msg.data.opId);
      }
      console.log(`${name}: Received op #${received}, ID: ${msg.data?.opId?.substring(0, 8)}`);
    }
  });

  return {
    ws,
    sendMixed(n) {
      if (!ready) return setTimeout(() => this.sendMixed(n), 50);
      
      console.log(`\n${name}: Sending ${n} operations (some duplicates)`);
      
      // Create some duplicate IDs
      const dupId1 = randomUUID();
      const dupId2 = randomUUID();
      
      for (let i = 0; i < n; i++) {
        let opId;
        
        // Make operations 3, 7, 15 duplicates
        if (i === 3 || i === 7 || i === 15) {
          opId = dupId1; // Same ID for ops 3, 7, 15
        } else if (i === 10 || i === 20) {
          opId = dupId2; // Same ID for ops 10, 20
        } else {
          opId = randomUUID(); // Unique ID
        }
        
        const op = {
          opId: opId,
          userId: clientId,
          baseVersion: base,
          type: "insert",
          pos: 0,
          text: "x"
        };
        
        console.log(`${name}: Sending op ${i+1}, ID: ${opId.substring(0, 8)} ${i === 3 || i === 7 || i === 15 || i === 10 || i === 20 ? '(DUPLICATE)' : ''}`);
        ws.send(JSON.stringify({ type: "op", op }));
      }
    },
    get count() { return received; },
    get uniqueOps() { return receivedOps.size; }
  };
}

const A = makeClient("A");
const B = makeClient("B");

setTimeout(() => {
  console.log("\n=== Sending batch with duplicates ===");
  B.sendMixed(20); // Send 20 ops, 5 are duplicates
}, 1000);

setTimeout(() => {
  console.log("\n=== RESULTS ===");
  console.log("B sent: 20 operations (5 duplicates by opId)");
  console.log("A received total:", A.count);
  console.log("A received unique:", A.uniqueOps);
  console.log("\nExpected: Less than 20 (due to batching + deduplication)");
  console.log("If duplicates deduplicated: Should be even fewer");
  
  process.exit(0);
}, 3000);