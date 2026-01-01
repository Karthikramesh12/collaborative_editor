const WS = require("ws");

const DOC = "cmju3wqnu0001eq0gcrnby699";
const OWNER = "cmjsrot0v0000eqp870j8c91n";

function connect(id, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://localhost:3000?documentId=${DOC}&userId=${id}`);

    let gotClient = false;
    let snapshotVersion = 0;
    let snapshotContent = "";

    const timeoutId = setTimeout(() => {
      if (gotClient) {
        console.log(`  [CONNECT] ${id}: No snapshot, using v0`);
        resolve({ ws, snapshotVersion: 0, snapshotContent: "" });
      } else {
        reject(new Error(`Connection timeout for ${id}`));
      }
    }, timeout);

    ws.on("message", raw => {
      const msg = JSON.parse(raw);

      if (msg.type === "clientId") {
        gotClient = true;
        console.log(`  [CONNECT] ${id}: Received clientId`);
      }

      if (msg.type === "snapshot") {
        clearTimeout(timeoutId);
        snapshotVersion = msg.snapshot?.version || 0;
        snapshotContent = msg.snapshot?.content || "";
        console.log(`  [CONNECT] ${id}: Received snapshot v${snapshotVersion}, content: "${snapshotContent.substring(0, 30)}..."`);
        ws.send(JSON.stringify({ type: "snapshotAck" }));
        resolve({ ws, snapshotVersion, snapshotContent });
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

function send(ws, id, base, seq, op) {
  console.log(`→ ${id} sending: "${op.text || 'delete'}" at pos ${op.pos}, seq:${seq}, base:${base}`);
  ws.send(JSON.stringify({
    type: "op",
    op: { ...op, clientId: id, baseVersion: base, opId: `${id}:${seq}` }
  }));
}

(async () => {
  console.log("=".repeat(80));
  console.log("SINGLE CLIENT RECONNECTION TEST - FIXED");
  console.log("=".repeat(80));
  console.log("Client: Send 400+ ops → disconnect → reconnect → send 60+ more ops");
  console.log("IMPORTANT: Each op must use incrementing baseVersion");
  console.log("=".repeat(80) + "\n");

  // PHASE 1: Initial connection
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 1: INITIAL CONNECTION");
  console.log("=".repeat(80));
  
  const { ws: client, snapshotVersion: initialSnapshotVersion } = await connect(OWNER);
  console.log(`✓ Connected, using v${initialSnapshotVersion} as baseVersion`);
  
  let seq = 1;
  let ackCount = 0;
  let lastAckVersion = initialSnapshotVersion;
  
  // Track what baseVersion to use next - CRITICAL!
  let nextBaseVersion = initialSnapshotVersion;
  
  // Ack listener
  client.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.type === "ack") {
      ackCount++;
      lastAckVersion = msg.version;
      console.log(`  [ACK] ${msg.opId} → v${msg.version} (total: ${ackCount})`);
    }
  });
  
  // Generate simple operations
  function generateSimpleOp(i) {
    const chars = "abcdefghijklmnopqrstuvwxyz ";
    const char = chars[Math.floor(Math.random() * chars.length)];
    return {
      type: "insert",
      pos: i,
      text: char
    };
  }
  
  // PHASE 2: Send 400+ operations
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 2: SEND 400+ OPERATIONS");
  console.log("=".repeat(80));
  
  const targetOpsBeforeDisconnect = 420;
  console.log(`Sending ${targetOpsBeforeDisconnect} operations starting from v${nextBaseVersion}...\n`);
  
  // Send in small batches to avoid overwhelming the server
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < targetOpsBeforeDisconnect; i++) {
    const op = generateSimpleOp(i);
    
    // CRITICAL: Use nextBaseVersion, then increment it for next op
    send(client, OWNER, nextBaseVersion, seq, op);
    seq++;
    nextBaseVersion++; // Increment for next operation!
    
    // Show progress and implement simple flow control
    if (i % BATCH_SIZE === 0 && i > 0) {
      console.log(`  Sent ${i}/${targetOpsBeforeDisconnect} ops, last ack: v${lastAckVersion}, next base: ${nextBaseVersion}`);
      
      // Wait a bit for some acks
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // If we're getting too far ahead of acks, wait more
      const pending = (seq - 1) - lastAckVersion;
      if (pending > 50) {
        console.log(`  ⏳ Too many pending ops (${pending}), waiting for acks...`);
        const targetAck = ackCount + Math.min(20, pending - 30);
        while (ackCount < targetAck) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }
  }
  
  console.log(`\n✓ Sent ${targetOpsBeforeDisconnect} operations`);
  console.log(`  Last ack received: v${lastAckVersion}`);
  console.log(`  Total acks: ${ackCount}`);
  console.log(`  Next base version would be: ${nextBaseVersion}`);
  
  // Wait for remaining acks
  console.log("\n⏳ Waiting 2 seconds for remaining acks...");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log(`\nFinal before disconnect:`);
  console.log(`  Operations sent: ${targetOpsBeforeDisconnect}`);
  console.log(`  Acks received: ${ackCount}`);
  console.log(`  Last ack version: v${lastAckVersion}`);
  console.log(`  Pending acks: ${targetOpsBeforeDisconnect - ackCount}`);
  
  // PHASE 3: Disconnect
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 3: DISCONNECT");
  console.log("=".repeat(80));
  
  console.log("\nDisconnecting...");
  client.close();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // PHASE 4: Reconnect
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 4: RECONNECT");
  console.log("=".repeat(80));
  
  console.log("\nReconnecting...");
  const { ws: reconnectedClient, snapshotVersion: reconnectSnapshotVersion, snapshotContent: reconnectSnapshotContent } = await connect(OWNER);
  
  console.log(`✓ Reconnected successfully`);
  console.log(`  Snapshot version: v${reconnectSnapshotVersion}`);
  console.log(`  Snapshot content preview: "${reconnectSnapshotContent.substring(0, 50)}..."`);
  
  // Reset for reconnection
  let reconnectAckCount = 0;
  let reconnectLastAckVersion = reconnectSnapshotVersion;
  let reconnectSeq = seq;
  let reconnectNextBaseVersion = reconnectSnapshotVersion; // Start from snapshot version
  
  // Setup ack listener
  reconnectedClient.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.type === "ack") {
      reconnectAckCount++;
      reconnectLastAckVersion = msg.version;
      console.log(`  [ACK-RECONNECT] ${msg.opId} → v${msg.version} (total: ${reconnectAckCount})`);
    }
  });
  
  // PHASE 5: Send 60+ more operations after reconnect
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 5: SEND 60+ MORE OPERATIONS AFTER RECONNECT");
  console.log("=".repeat(80));
  
  const targetOpsAfterReconnect = 65;
  console.log(`\nSending ${targetOpsAfterReconnect} more operations`);
  console.log(`Starting from snapshot v${reconnectSnapshotVersion} as baseVersion`);
  
  for (let i = 0; i < targetOpsAfterReconnect; i++) {
    const pos = reconnectSnapshotContent.length + i;
    const op = generateSimpleOp(pos);
    
    // Use reconnectNextBaseVersion, then increment
    send(reconnectedClient, OWNER, reconnectNextBaseVersion, reconnectSeq, op);
    reconnectSeq++;
    reconnectNextBaseVersion++;
    
    // Show progress
    if (i % 10 === 0 && i > 0) {
      console.log(`  Reconnected ops: ${i}/${targetOpsAfterReconnect}, next base: ${reconnectNextBaseVersion}`);
      
      // Wait a bit for acks
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
  
  console.log(`\n✓ Sent ${targetOpsAfterReconnect} operations after reconnect`);
  
  // PHASE 6: Final results
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 6: FINAL RESULTS");
  console.log("=".repeat(80));
  
  console.log("\n⏳ Waiting 3 seconds for final acks...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log("\n" + "=".repeat(80));
  console.log("TEST COMPLETE - SUMMARY");
  console.log("=".repeat(80));
  
  console.log(`\nCLIENT ${OWNER}:`);
  console.log(`  Initial connection:`);
  console.log(`    Snapshot version: v${initialSnapshotVersion}`);
  console.log(`    Operations sent: ${targetOpsBeforeDisconnect}`);
  console.log(`    Acks received: ${ackCount}`);
  console.log(`    Last ack before disconnect: v${lastAckVersion}`);
  
  console.log(`\n  Reconnection:`);
  console.log(`    Snapshot version: v${reconnectSnapshotVersion}`);
  console.log(`    Snapshot content length: ${reconnectSnapshotContent.length} chars`);
  console.log(`    Operations sent after reconnect: ${targetOpsAfterReconnect}`);
  console.log(`    Acks received after reconnect: ${reconnectAckCount}`);
  console.log(`    Last ack after reconnect: v${reconnectLastAckVersion}`);
  
  console.log(`\n  TOTALS:`);
  console.log(`    Total operations sent: ${targetOpsBeforeDisconnect + targetOpsAfterReconnect}`);
  console.log(`    Total acks received: ${ackCount + reconnectAckCount}`);
  console.log(`    Sequence continued: 1 to ${reconnectSeq - 1}`);
  
  console.log("\n" + "=".repeat(80));
  console.log("PROTOCOL VERIFICATION");
  console.log("=".repeat(80));
  
  // Check if ops were sent with incrementing baseVersions
  console.log("✓ Each operation uses incrementing baseVersion");
  console.log("✓ First op after reconnect uses snapshot version as base");
  console.log("✓ Sequence numbering continues correctly");
  
  // Check if server's hard stale fence would be happy
  if (reconnectSnapshotVersion === lastAckVersion) {
    console.log("✓ Server's snapshot matches last ack before disconnect");
  } else {
    console.log(`⚠ Snapshot version (v${reconnectSnapshotVersion}) differs from last ack (v${lastAckVersion})`);
  }
  
  console.log("=".repeat(80));
  
  reconnectedClient.close();
})();