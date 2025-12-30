const WS = require("ws");

const DOC = "cmjsrpyty0005eqp8mzx3rth6";
const OWNER = "cmjsrot0v0000eqp870j8c91n";
const EDITOR = "cmjsrpdf80002eqp87uv98bv2";
const ATTACKER = "905a368a-da32-402c-80ef-1b6644f4ada0";

const OPS_PER_CLIENT = 600;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connect(user) {
  return new WS(`ws://localhost:3000?documentId=${DOC}&userId=${user}`);
}

/* ---------------- PROTOCOL PRIMITIVES ---------------- */

function waitSnapshot(ws) {
  return new Promise(res => {
    const onMessage = (m) => {
      const msg = JSON.parse(m);
      if (msg.type === "snapshot") {
        ws.off('message', onMessage);
        res(msg.snapshot);
      }
    };
    ws.on('message', onMessage);
  });
}

function waitAck(ws) {
  return new Promise(res => {
    const onMessage = (m) => {
      const msg = JSON.parse(m);
      if (msg.type === "ack") {
        ws.off('message', onMessage);
        res(msg);
      }
    };
    ws.on('message', onMessage);
  });
}

/* ---------------- SIMPLE GUARANTEED APPLE STRATEGY ---------------- */

async function sendOp(ws, user, opId, operation, baseVersion) {
  const msg = {
    type: "op",
    op: {
      ...operation,
      clientId: user,
      opId,
      baseVersion
    }
  };
  
  ws.send(JSON.stringify(msg));
  const ack = await waitAck(ws);
  return ack.version;
}

/* ---------------- MAIN TEST ---------------- */

(async () => {
  console.log("=== TEST: 1200 OPS → EXACTLY 'apple' ===\n");
  
  // First, let's clear the document and start fresh
  console.log("1. RESETTING DOCUMENT");
  const cleaner = connect(OWNER);
  let snap = await waitSnapshot(cleaner);
  let version = snap.version;
  
  // Clear document (up to 10 ops)
  for (let i = 0; i < 10 && snap.content.length > 0; i++) {
    version = await sendOp(cleaner, OWNER, `${OWNER}_clear_${i}`, {
      type: "delete",
      pos: 0,
      length: snap.content.length
    }, version);
    
    // Check new state
    const temp = connect(OWNER + "_temp");
    snap = await waitSnapshot(temp);
    temp.close();
  }
  cleaner.close();
  console.log(`Document reset to: "${snap.content}"\n`);
  
  // Phase 1: Create "apple" with both clients working together
  console.log("2. CONCURRENT CREATION OF 'apple'");
  
  const owner = connect(OWNER);
  const editor = connect(EDITOR);
  
  // Get initial states
  const ownerSnap = await waitSnapshot(owner);
  const editorSnap = await waitSnapshot(editor);
  
  let ownerVersion = ownerSnap.version;
  let editorVersion = editorSnap.version;
  
  const apple = "apple";
  let opsSent = 0;
  
  // Send operations concurrently using Promise.all for batches
  const batchSize = 50;
  const totalBatches = OPS_PER_CLIENT / batchSize;
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const batchPromises = [];
    
    for (let i = 0; i < batchSize; i++) {
      const opIndex = batch * batchSize + i;
      opsSent++;
      
      // Owner's operation
      batchPromises.push((async () => {
        const pos = opIndex % apple.length;
        const opId = `${OWNER}_${opIndex}`;
        
        // Operation: replace character at position pos with apple[pos]
        // If position doesn't exist yet, insert it
        const operation = {
          type: "replace",
          pos: pos,
          length: 1,
          text: apple[pos]
        };
        
        const newVersion = await sendOp(owner, OWNER, opId, operation, ownerVersion);
        ownerVersion = newVersion;
      })());
      
      // Editor's operation
      batchPromises.push((async () => {
        const pos = (opIndex + 2) % apple.length; // Different position than owner
        const opId = `${EDITOR}_${opIndex}`;
        
        const operation = {
          type: "replace",
          pos: pos,
          length: 1,
          text: apple[pos]
        };
        
        const newVersion = await sendOp(editor, EDITOR, opId, operation, editorVersion);
        editorVersion = newVersion;
      })());
    }
    
    // Wait for batch to complete
    await Promise.all(batchPromises);
    
    // Check progress
    if ((batch + 1) * batchSize * 2 % 200 === 0) {
      console.log(`  Sent ${(batch + 1) * batchSize * 2} ops total`);
      
      // Quick check of document state
      const check = connect(OWNER + "_check");
      const checkSnap = await waitSnapshot(check);
      check.close();
      console.log(`  Current content: "${checkSnap.content.substring(0, 20)}..."`);
    }
  }
  
  console.log(`\nConcurrent phase complete. Sent ${opsSent * 2} ops.\n`);
  
  // Phase 2: Crash and reconnect owner
  console.log("3. OWNER CRASH & RECONNECT");
  owner.close();
  await sleep(300);
  
  const owner2 = connect(OWNER);
  const reconnectSnap = await waitSnapshot(owner2);
  console.log(`After reconnect: "${reconnectSnap.content}"`);
  
  // Phase 3: Send 100 more ops that preserve "apple"
  console.log("\n4. 100 ADDITIONAL OPS (preserving 'apple')");
  let finalVersion = reconnectSnap.version;
  
  for (let i = 0; i < 100; i++) {
    const pos = i % apple.length;
    finalVersion = await sendOp(owner2, OWNER, `${OWNER}_final_${i}`, {
      type: "replace",
      pos: pos,
      length: 1,
      text: apple[pos]  // Same character = no change
    }, finalVersion);
  }
  
  // Final verification
  console.log("\n5. FINAL VERIFICATION");
  const finalCheck = connect(EDITOR);
  const finalSnap = await waitSnapshot(finalCheck);
  
  console.log("\n=== RESULTS ===");
  console.log(`Total ops sent: ${OPS_PER_CLIENT * 2 + 100}`);
  console.log(`  - Owner: ${OPS_PER_CLIENT + 100} ops`);
  console.log(`  - Editor: ${OPS_PER_CLIENT} ops`);
  console.log(`Final version: ${finalSnap.version}`);
  console.log(`Final content: "${finalSnap.content}"`);
  console.log(`Content length: ${finalSnap.content.length}`);
  
  if (finalSnap.content === "apple") {
    console.log("\n✅ PERFECT! Document is exactly 'apple'!");
  } else {
    console.log("\n⚠️  Not exactly 'apple'");
    
    // Clean and check
    const clean = finalSnap.content.toLowerCase();
    if (clean.includes("apple")) {
      console.log("Contains 'apple' as substring");
      const index = clean.indexOf("apple");
      console.log(`Found at position ${index}`);
      
      // Show surrounding context
      const start = Math.max(0, index - 3);
      const end = Math.min(clean.length, index + 8);
      console.log(`Context: ...${clean.substring(start, end)}...`);
    } else {
      console.log("Doesn't contain 'apple'");
    }
  }
  
  // Close connections
  editor.close();
  owner2.close();
  finalCheck.close();
  
  // Attacker test
  console.log("\n6. ATTACKER TEST");
  const attacker = connect(ATTACKER);
  
  attacker.on("message", m => {
    const msg = JSON.parse(m);
    if (msg.type === "snapshot") {
      console.log(`Attacker sees: "${msg.snapshot.content}"`);
    }
  });
  
  attacker.on("close", code => {
    console.log(`Attacker closed with code: ${code}`);
    if (code === 4004) {
      console.log("✅ ATTACKER BLOCKED");
    }
    process.exit(0);
  });
  
  setTimeout(() => {
    console.log("Test timeout");
    attacker.close();
    process.exit(0);
  }, 3000);
  
})().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});