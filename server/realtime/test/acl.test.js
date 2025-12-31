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

function waitAck(ws, clientId) {
  return new Promise(res => {
    const handler = raw => {
      const msg = JSON.parse(raw);
      if (msg.type === "ack") {
        console.log(`✓ Client ${clientId} received ack at version ${msg.version}`);
        ws.off("message", handler);
        res(msg.version);
      }
    };
    ws.on("message", handler);
  });
}

function send(ws, id, base, seq, op) {
  console.log(`→ Client ${id} sending: "${op.text}" at position ${op.pos}`);
  ws.send(JSON.stringify({
    type: "op",
    op: { ...op, clientId: id, baseVersion: base, opId: `${id}:${seq}` }
  }));
}

// Helper function to walk alphabet for a single character
async function walkAlphabetStep(ws, clientId, baseVersion, seq, currentChar, nextChar, position, isInsert = false) {
  let localSeq = seq;
  
  if (isInsert) {
    send(ws, clientId, baseVersion, localSeq++, { 
      type: "insert", 
      pos: position, 
      text: currentChar 
    });
  } else {
    send(ws, clientId, baseVersion, localSeq++, { 
      type: "replace", 
      pos: position, 
      text: nextChar,
      length: 1 
    });
  }
  
  const newVersion = await waitAck(ws, clientId);
  
  // Small delay to make the animation visible
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return { version: newVersion, seq: localSeq };
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
  const totalSteps = target.length;
  
  console.log(`\nTarget: "${target}"`);
  console.log("Starting sequential walking alphabet...\n");
  
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
      const result = await walkAlphabetStep(
        currentClient, 
        clientId, 
        currentVersion, 
        currentSeq, 
        ' ', 
        ' ', 
        i, 
        true
      );
      currentVersion = result.version;
      
      // Update the correct sequence counter
      if (i % 2 === 0) {
        seqA = result.seq;
      } else {
        seqB = result.seq;
      }
      
      console.log(`✓ Position ${i}: Space inserted`);
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
    let result = await walkAlphabetStep(
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
    
    // Walk through the alphabet step by step
    for (let step = 0; step < steps; step++) {
      const currentCharCode = startCode + (direction * step);
      const nextCharCode = startCode + (direction * (step + 1));
      const nextChar = String.fromCharCode(((nextCharCode - 97 + 26) % 26) + 97);
      
      result = await walkAlphabetStep(
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
      
      console.log(`  Step ${step + 1}/${steps}: '${String.fromCharCode(((currentCharCode - 97 + 26) % 26) + 97)}' → '${nextChar}'`);
    }
    
    // Update the correct sequence counter
    if (i % 2 === 0) {
      seqA = localSeq;
    } else {
      seqB = localSeq;
    }
    
    console.log(`✓ Position ${i}: Completed '${targetChar}'`);
  }
  
  console.log("\n═══════════════════════════════════════");
  console.log("DONE - Final text: \"hello world\"");
  console.log(`Total characters: ${target.length}`);
  console.log(`Client A (${OWNER}) operations: ${seqA - 1}`);
  console.log(`Client B (${EDITOR}) operations: ${seqB - 1}`);
  console.log("═══════════════════════════════════════\n");
  
  // Close connections
  clientA.close();
  clientB.close();
})();