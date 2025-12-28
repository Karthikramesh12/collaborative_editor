const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "flood-test";

function makeClient() {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let ready = false;
  let clientId = null;
  let base = 0;

  ws.on("message", m => {
    const msg = JSON.parse(m);
    if (msg.type === "clientId") {
      clientId = msg.clientId;
      console.log("Client ID:", clientId.substring(0, 8) + "...");
    }
    if (msg.type === "snapshot") {
      base = msg.snapshot.version;
      console.log("Got snapshot, base version:", base);
      ready = true;
    }
    if (msg.type === "ack") {
      base = msg.version;
      console.log("Got ack, new version:", base);
    }
    if (msg.type === "resync") {
      console.log("GOT RESYNC - Client was too stale");
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });

  ws.on("close", (code, reason) => {
    console.log(`Connection closed: ${code} - ${reason}`);
  });

  return {
    ws,
    flood() {
      if (!ready) return setTimeout(() => this.flood(), 50);
      console.log("B STARTS FLOOD ATTACK - Sending 500 ops");
      
      for (let i = 0; i < 500; i++) {
        ws.send(JSON.stringify({
          type: "op",
          op: {
            opId: randomUUID(),
            userId: clientId,      // Use userId (some systems use this)
            clientId: clientId,    // Also include clientId for compatibility
            baseVersion: base,     // ✅ CORRECT FIELD NAME
            type: "insert",
            pos: 0,
            text: "X"
          }
        }));
        
        // Small delay to avoid overwhelming
        if (i % 100 === 0) {
          console.log(`  Sent ${i + 1} ops...`);
        }
      }
      console.log("Flood attack complete - sent 500 ops");
    }
  };
}

const B = makeClient();
setTimeout(() => B.flood(), 500);

// Close after 5 seconds
setTimeout(() => {
  console.log("Test complete, closing...");
  process.exit(0);
}, 5000);