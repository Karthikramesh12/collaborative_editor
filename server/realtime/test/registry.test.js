const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "stale-registry";

function client(name) {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let base = 0;
  let clientId = null; // Track the assigned clientId

  ws.on("message", r => {
    const m = JSON.parse(r);
    
    // Store the clientId when server assigns it
    if (m.type === "clientId") {
      clientId = m.clientId;
      console.log(`${name} got clientId: ${clientId.substring(0, 8)}...`);
    }
    
    if (m.type === "snapshot") {
      base = m.snapshot.version;
      console.log(`${name} got snapshot, version: ${base}`);
    }
    if (m.type === "ack") base = m.version;
    if (m.type === "resync") {
      console.log("RESYNCED", name, "->", m.snapshot.version);
      base = m.snapshot.version;
    }
  });

  return {
    ws,
    send(txt) {
      // Wait for clientId before sending operations
      if (!clientId) {
        console.log(`${name} waiting for clientId...`);
        return;
      }
      
      ws.send(JSON.stringify({
        type: "op",
        op: {
          opId: randomUUID(),
          clientId: clientId, // Use the server-assigned clientId
          baseVersion: base, // ignored by server now
          type: "insert",
          pos: 0,
          text: txt
        }
      }));
    }
  };
}

const A = client("A");
const B = client("B");

// A will advance document far beyond window
setTimeout(() => {
  console.log("A starts flooding...");
  for (let i = 0; i < 200; i++) {
    A.send("A" + i);
  }
  console.log("A finished flooding");
}, 200);

// B stays idle and becomes stale
setTimeout(() => {
  console.log("B is stale and sending");
  B.send("B1");
}, 2000);