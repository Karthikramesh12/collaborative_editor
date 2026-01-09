const WS = require("ws");

const DOC = "cmju3wqnu0001eq0gcrnby699";
const OWNER = "cmjsrot0v0000eqp870j8c91n";
const EDITOR = "cmjsrpdf80002eqp87uv98bv2";

function connect(id) {
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://localhost:3000?documentId=${DOC}&userId=${id}`);

    let gotClient = false;
    let gotSnap = false;

    ws.on("message", raw => {
      const msg = JSON.parse(raw);

      if (msg.type === "clientId") gotClient = true;

      if (msg.type === "snapshot") {
        gotSnap = true;
        ws.send(JSON.stringify({ type: "snapshotAck" }));
      }

      if (gotClient && gotSnap) resolve(ws);
    });

    ws.on("error", reject);
  });
}

function send(ws, id, base, seq, op) {
  console.log(`→ ${id} sending: "${op.text}" at position ${op.pos}, seq:${seq}, base:${base}`);
  ws.send(JSON.stringify({
    type: "op",
    op: { ...op, clientId: id, baseVersion: base, opId: `${id}:${seq}` }
  }));
}

// Modified walkAlphabetStep: sends WITHOUT waiting for ack
function walkAlphabetStep(ws, clientId, baseVersion, seq, currentChar, nextChar, position, isInsert = false) {
  if (isInsert) {
    send(ws, clientId, baseVersion, seq, { 
      type: "insert", 
      pos: position, 
      text: currentChar 
    });
  } else {
    send(ws, clientId, baseVersion, seq, { 
      type: "replace", 
      pos: position, 
      text: nextChar,
      length: 1 
    });
  }
  
  // Increment BOTH seq and baseVersion optimistically for next operation
  return { seq: seq + 1, version: baseVersion + 1 };
}

(async () => {
  // Connect both clients
  const clientA = await connect(OWNER);
  const clientB = await connect(EDITOR);
  
  console.log("Both clients connected");

  let seqA = 1;
  let seqB = 1;
  let currentVersion = 0;
  
  const target = "hello world";
  
  console.log(`\nTarget: "${target}"`);
  console.log("Starting walking alphabet WITHOUT waiting for acks...\n");
  
  // Set up ack listeners for BOTH clients
  let ackCountA = 0;
  let ackCountB = 0;
  let lastAckVersionA = 0;
  let lastAckVersionB = 0;
  
  clientA.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.type === "ack") {
      ackCountA++;
      lastAckVersionA = msg.version;
      console.log(`  [ACK A] ${msg.opId} → v${msg.version} (total: ${ackCountA})`);
    } else if (msg.type === "snapshot") {
      console.log(`  [SNAPSHOT A] received at v${msg.version}`);
      clientA.send(JSON.stringify({ type: "snapshotAck" }));
    }
  });
  
  clientB.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.type === "ack") {
      ackCountB++;
      lastAckVersionB = msg.version;
      console.log(`  [ACK B] ${msg.opId} → v${msg.version} (total: ${ackCountB})`);
    } else if (msg.type === "snapshot") {
      console.log(`  [SNAPSHOT B] received at v${msg.version}`);
      clientB.send(JSON.stringify({ type: "snapshotAck" }));
    }
  });
  
  // Process characters one by one, alternating between clients
  for (let i = 0; i < target.length; i++) {
    const targetChar = target[i];
    
    // Determine which client handles this position (alternating)
    const currentClient = i % 2 === 0 ? clientA : clientB;
    const clientId = i % 2 === 0 ? OWNER : EDITOR;
    const currentSeq = i % 2 === 0 ? seqA : seqB;
    
    console.log(`\n=== Position ${i}: Target '${targetChar}' (Client ${clientId}) ===`);
    
    if (targetChar === ' ') {
      // For space, just insert it directly
      const result = walkAlphabetStep(
        currentClient, 
        clientId, 
        currentVersion, 
        currentSeq, 
        ' ', 
        ' ', 
        i, 
        true
      );
      currentVersion = result.version; // Optimistically increment version
      
      // Update the correct sequence counter
      if (i % 2 === 0) {
        seqA = result.seq;
      } else {
        seqB = result.seq;
      }
      
      console.log(`✓ Position ${i}: Space sent (next base:${currentVersion})`);
      
      // Small delay to make the animation visible (but NO waiting for ack!)
      await new Promise(resolve => setTimeout(resolve, 50));
      continue;
    }
    
    // Walk from 'a' to target character
    const startChar = 'a';
    const startCode = startChar.charCodeAt(0);
    const targetCode = targetChar.charCodeAt(0);
    
    // Calculate direction (positive = forward, negative = backward)
    const forwardDistance = (targetCode - startCode + 26) % 26;
    const backwardDistance = (startCode - targetCode + 26) % 26;
    
    // Choose shorter path
    const direction = forwardDistance <= backwardDistance ? 1 : -1;
    const steps = direction === 1 ? forwardDistance : backwardDistance;
    
    console.log(`Walking from '${startChar}' to '${targetChar}' (${steps} steps)`);
    
    // Insert starting character 'a'
    let result = walkAlphabetStep(
      currentClient, 
      clientId, 
      currentVersion, 
      currentSeq, 
      startChar, 
      startChar, 
      i, 
      true
    );
    
    currentVersion = result.version;
    let localSeq = result.seq;
    
    console.log(`  Sent '${startChar}' (next base:${currentVersion})`);
    
    // Walk through the alphabet step by step
    for (let step = 0; step < steps; step++) {
      const currentCharCode = startCode + (direction * step);
      const nextCharCode = startCode + (direction * (step + 1));
      const nextChar = String.fromCharCode(((nextCharCode - 97 + 26) % 26) + 97);
      
      result = walkAlphabetStep(
        currentClient, 
        clientId, 
        currentVersion, 
        localSeq, 
        String.fromCharCode(((currentCharCode - 97 + 26) % 26) + 97), 
        nextChar, 
        i, 
        false
      );
      
      currentVersion = result.version;
      localSeq = result.seq;
      
      console.log(`  Step ${step + 1}/${steps}: sent '${nextChar}' (next base:${currentVersion})`);
      
      // Small delay to make the animation visible (but NO waiting for ack!)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Update the correct sequence counter
    if (i % 2 === 0) {
      seqA = localSeq;
    } else {
      seqB = localSeq;
    }
    
    console.log(`✓ Position ${i}: All ops for '${targetChar}' sent`);
  }
  
  console.log("\n═══════════════════════════════════════");
  console.log("ALL OPERATIONS SENT - NO WAITING FOR ACKS");
  console.log("═══════════════════════════════════════");
  
  // Wait a bit to collect acks
  console.log("\nWaiting 5 seconds to collect acks...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log("\n═══════════════════════════════════════");
  console.log("FINAL RESULTS");
  console.log("═══════════════════════════════════════");
  console.log(`Target text: "${target}"`);
  console.log(`\nClient A:`);
  console.log(`  Operations sent: ${seqA - 1}`);
  console.log(`  Acks received: ${ackCountA}`);
  console.log(`  Last ack version: v${lastAckVersionA}`);
  console.log(`  Optimistic version sent: v${currentVersion}`);
  console.log(`\nClient B:`);
  console.log(`  Operations sent: ${seqB - 1}`);
  console.log(`  Acks received: ${ackCountB}`);
  console.log(`  Last ack version: v${lastAckVersionB}`);
  console.log(`  Optimistic version sent: v${currentVersion}`);
  console.log(`\nTotal:`);
  console.log(`  Operations sent: ${(seqA - 1) + (seqB - 1)}`);
  console.log(`  Acks received: ${ackCountA + ackCountB}`);
  console.log(`  Missing acks: ${(seqA - 1) + (seqB - 1) - (ackCountA + ackCountB)}`);
  
  // Calculate version differences
  const versionDiffA = currentVersion - lastAckVersionA;
  const versionDiffB = currentVersion - lastAckVersionB;
  
  console.log(`\nVersion analysis:`);
  console.log(`  Client A optimistic vs ack: ${currentVersion} vs ${lastAckVersionA} (diff: ${versionDiffA})`);
  console.log(`  Client B optimistic vs ack: ${currentVersion} vs ${lastAckVersionB} (diff: ${versionDiffB})`);
  
  if (versionDiffA > 0 || versionDiffB > 0) {
    console.log(`\n⚠️  Optimistic versions ahead of acks (expected with fire-and-forget)`);
    console.log(`   This means ops were sent with stale baseVersion`);
  }
  
  if (ackCountA + ackCountB < (seqA - 1) + (seqB - 1)) {
    console.log(`\n⚠️  Missing ${(seqA - 1) + (seqB - 1) - (ackCountA + ackCountB)} acks`);
    console.log(`   Some operations may have been rejected or are still pending`);
  }
  
  console.log("\nKey behavior:");
  console.log("1. Walking alphabet logic preserved");
  console.log("2. NO waiting for acks between operations");
  console.log("3. opId incremented for each send");
  console.log("4. baseVersion incremented optimistically");
  console.log("5. Acks logged when they arrive (async)");
  console.log("═══════════════════════════════════════\n");
  
  // Close connections
  clientA.close();
  clientB.close();
})();