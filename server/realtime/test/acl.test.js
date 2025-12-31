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

function waitAck(ws) {
  return new Promise(res => {
    const handler = raw => {
      const msg = JSON.parse(raw);
      if (msg.type === "ack") {
        ws.off("message", handler);
        res(msg.version);
      }
    };
    ws.on("message", handler);
  });
}

function send(ws, id, base, seq, op) {
  ws.send(JSON.stringify({
    type: "op",
    op: { ...op, clientId: id, baseVersion: base, opId: `${id}:${seq}` }
  }));
}

(async () => {
  const A = await connect(OWNER);

  let aSeq = 1;
  let aVer = 0;

  const target = "hello world";
  let currentText = "";

  // Start from 'a' and walk to each target character
  for (let i = 0; i < target.length; i++) {
    const targetChar = target[i];
    
    if (targetChar === ' ') {
      // For space, just insert it directly
      send(A, OWNER, aVer, aSeq++, { type: "insert", pos: i, text: ' ' });
      aVer = await waitAck(A);
      currentText += ' ';
      continue;
    }

    // Determine if we need to go forward or backward in alphabet
    const startChar = currentText.length > i ? currentText[i] : 'a';
    const startCode = startChar.charCodeAt(0);
    const targetCode = targetChar.charCodeAt(0);
    
    // Calculate direction (positive = forward, negative = backward)
    const forwardDistance = (targetCode - startCode + 26) % 26;
    const backwardDistance = (startCode - targetCode + 26) % 26;
    
    // Choose shorter path
    const direction = forwardDistance <= backwardDistance ? 1 : -1;
    const steps = direction === 1 ? forwardDistance : backwardDistance;
    
    // Walk through the alphabet
    for (let step = 0; step < steps; step++) {
      const currentPos = i;
      const nextCharCode = startCode + (direction * (step + 1));
      const nextChar = String.fromCharCode(((nextCharCode - 97 + 26) % 26) + 97);
      
      if (step === 0) {
        // First step: insert the starting character if we haven't already
        send(A, OWNER, aVer, aSeq++, { type: "insert", pos: currentPos, text: startChar });
        aVer = await waitAck(A);
      }
      
      // Replace current character with next character in the walk
      send(A, OWNER, aVer, aSeq++, { 
        type: "replace", 
        pos: currentPos, 
        text: nextChar,
        length: 1 
      });
      aVer = await waitAck(A);
      
      // Small delay to make the animation visible (optional)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    currentText = currentText.slice(0, i) + targetChar + currentText.slice(i + 1);
  }

  console.log("DONE - Final text should be:", target);
})();