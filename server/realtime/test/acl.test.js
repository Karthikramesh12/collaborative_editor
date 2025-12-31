const WS = require("ws");

const DOC = "cmju3wqnu0001eq0gcrnby699";
const OWNER  = "cmjsrot0v0000eqp870j8c91n";
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

  const word = "hello world";

  for (let i = 0; i < word.length; i++) {
    send(A, OWNER, aVer, aSeq++, { type: "insert", pos: i, text: word[i] });
    aVer = await waitAck(A);    // server authoritative version
  }

  console.log("DONE");
})();
