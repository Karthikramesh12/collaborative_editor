const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const DOC = "lifecycle-stress";
const CLIENTS = 5;
const OPS_PER_CLIENT = 20;
const FLOOD_DUP_RATIO = 0.35;

function makeClient(name) {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let base = 0;
  let id;
  let recv = 0;

  ws.on("message", m => {
    const msg = JSON.parse(m);

    if (msg.type === "clientId") id = msg.clientId;
    if (msg.type === "snapshot") base = msg.snapshot.version;
    if (msg.type === "op") {
      recv++;
      base = msg.data.version;
    }
  });

  return {
    sendFlood() {
      const dupBag = [];
      for (let i = 0; i < OPS_PER_CLIENT; i++) {
        const opId = Math.random() < FLOOD_DUP_RATIO && dupBag.length
          ? dupBag[Math.floor(Math.random() * dupBag.length)]
          : randomUUID();

        dupBag.push(opId);

        ws.send(JSON.stringify({
          type: "op",
          op: {
            opId,
            userId: id,
            baseVersion: base,
            type: "insert",
            pos: 0,
            text: name[0]
          }
        }));
      }
    },
    close() { ws.close(); },
    get recv() { return recv; }
  };
}

/* Phase 1: Concurrent floods */
const clients = [];
for (let i = 0; i < CLIENTS; i++) {
  clients.push(makeClient("C" + i));
}

setTimeout(() => {
  console.log("\nPHASE 1 — concurrent flood");
  clients.forEach(c => c.sendFlood());
}, 1000);

/* Phase 2: Idle eviction */
setTimeout(() => {
  console.log("\nPHASE 2 — idle unload");
  clients.forEach(c => c.close());
}, 3000);

/* Phase 3: Reload & continue */
setTimeout(() => {
  console.log("\nPHASE 3 — reload & continue");
  const newClients = [];
  for (let i = 0; i < CLIENTS; i++) newClients.push(makeClient("R" + i));
  setTimeout(() => newClients.forEach(c => c.sendFlood()), 1000);
}, 9000);

/* Final verdict */
setTimeout(() => {
  console.log("\nIf server is still alive and no RESYNC_REQUIRED spam appeared — lifecycle is correct.");
  process.exit(0);
}, 15000);
