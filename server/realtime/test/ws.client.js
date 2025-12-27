const { randomUUID } = require("crypto");
const WebSocket = require("ws");

const CLIENTS = 6;
const OPS_PER_CLIENT = 10;
const DOC = "swarm-doc";

const clients = [];

for (let i = 0; i < CLIENTS; i++) {
  spawnClient(i);
}

function spawnClient(id) {
  const ws = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
  let localVersion = 0;

  ws.on("open", () => {
    console.log("client", id, "connected");
  });

  ws.on("message", raw => {
  const msg = JSON.parse(raw.toString());

  if (msg.type === "snapshot") {
    localVersion = msg.snapshot.version;
    fireOps();
  }

  if (msg.type === "op") {
    localVersion = msg.data.version;
  }

  if (msg.type === "final") {
    console.log("\nFINAL VERSION =", msg.version);
    console.log("CONTENT =\n" + msg.content.replace(/(\]\[)/g, "]\n["));
    process.exit(0);
  }
});

  function fireOps() {
    for (let i = 0; i < OPS_PER_CLIENT; i++) {
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: "op",
          op: {
            operationId: randomUUID(),
            baseVersion: localVersion,
            type: "insert",
            pos: 0,
            text: `[${id}:${i}]`
          }
        }));
      }, Math.random() * 200);
    }
  }

  clients.push(ws);
}
