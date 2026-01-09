const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "dup-doc";

const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);

let base = 0;
let sent = false;
let clientId = null;
let receivedOps = [];

ws.on("message", raw => {
  const msg = JSON.parse(raw.toString());
  console.log("\n[CLIENT] Received message type:", msg.type);

  if (msg.type === "clientId") {
    clientId = msg.clientId;
    console.log("[CLIENT] Got clientId:", clientId.substring(0, 8) + "...");
  }

  if (msg.type === "snapshot") {
    base = msg.snapshot.version;
    console.log("[CLIENT] Got snapshot, baseVersion:", base);
    console.log("[CLIENT] Document:", msg.snapshot.content || "(empty)");
    setTimeout(() => fire(), 100); // Small delay
  }

  if (msg.type === "op") {
    receivedOps.push(msg);
    console.log("[CLIENT] Operation broadcast received!");
    console.log("  Version:", msg.data?.version);
    console.log("  ServerSeq:", msg.data?.serverSeq);
    console.log("  Operation text:", msg.data?.op?.text || "N/A");
    console.log("  Operation ID:", msg.data?.opId?.substring(0, 8) || "N/A");
  }
  
  if (msg.type === "ack") {
    console.log("[CLIENT] Got ack for version:", msg.version);
  }
});

function fire() {
  if (sent || !clientId) return;
  sent = true;

  const opId = randomUUID();
  console.log("\n=== GENERATING OPERATION ===");
  console.log("Operation ID:", opId);

  const op = {
    opId: opId,
    userId: clientId,
    baseVersion: base,
    type: "insert",
    pos: 0,
    text: "[DUP]"
  };

  console.log("\n=== TEST 1: Sending first operation ===");
  ws.send(JSON.stringify({ type: "op", op }));

  // Send duplicate immediately (testing batching)
  setTimeout(() => {
    console.log("\n=== TEST 2: Sending duplicate operation (same opId) immediately ===");
    console.log("Testing: Should be deduplicated or batched");
    ws.send(JSON.stringify({ type: "op", op }));
  }, 10);

  // Send duplicate after 200ms
  setTimeout(() => {
    console.log("\n=== TEST 3: Sending duplicate after 200ms ===");
    console.log("Testing: Should be deduplicated (same opId)");
    ws.send(JSON.stringify({ type: "op", op }));
  }, 200);

  // Send different operation
  setTimeout(() => {
    const newOp = {
      opId: randomUUID(), // DIFFERENT opId
      userId: clientId,
      baseVersion: base,
      type: "insert",
      pos: 5, // Different position
      text: "[NEW]"
    };
    console.log("\n=== TEST 4: Sending new operation (different opId) ===");
    console.log("Operation ID:", newOp.opId);
    console.log("Testing: Should be processed normally");
    ws.send(JSON.stringify({ type: "op", op: newOp }));
  }, 400);
}

ws.on("error", (err) => {
  console.error("[CLIENT] WebSocket error:", err.message);
});

ws.on("close", (code, reason) => {
  console.log(`\n[CLIENT] Connection closed: ${code} - ${reason}`);
});

// Run test for 2 seconds
setTimeout(() => {
  console.log("\n=== TEST RESULTS ===");
  console.log("Total operations received:", receivedOps.length);
  console.log("Unique operation IDs:", new Set(receivedOps.map(m => m.data?.opId)).size);
  
  if (receivedOps.length > 0) {
    console.log("\nOperations received:");
    receivedOps.forEach((msg, i) => {
      console.log(`  ${i+1}. Version: ${msg.data?.version}, Text: "${msg.data?.op?.text}", OpId: ${msg.data?.opId?.substring(0, 8)}...`);
    });
  }
  
  console.log("\n=== EXPECTED BEHAVIOR ===");
  console.log("1. First operation: Should be processed");
  console.log("2. Immediate duplicate: Should be deduplicated (same opId)");
  console.log("3. Delayed duplicate: Should be deduplicated (same opId)");
  console.log("4. New operation: Should be processed");
  console.log("Total expected broadcasts: 2-3 (not 4)");
  
  ws.close();
  process.exit(0);
}, 2000);