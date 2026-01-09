const WS = require("ws");
const { v7: uuidv7 } = require('uuid');

const DOC = "cmjrak2890001eqv0kj8alwpg";
const A = "cmjk59lxc0000eqzsxbvxv0qe";
const B = "cmjk59lxc0000eqzsxbvxv0qe";

const WINDOW_PUSH = 400;
const AFTER_RESYNC_OPS = 50;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connect(user) {
  return new WS(`ws://localhost:3000?documentId=${DOC}&userId=${user}`);
}

function wait(ws, type) {
  return new Promise(res => {
    const handler = m => {
      const msg = JSON.parse(m);
      if (msg.type === type) {
        ws.off("message", handler);
        res(msg);
      }
    };
    ws.on("message", handler);
  });
}


function makeInsert(base, user) {
  return {
    type: "op",
    op: {
      type: "insert",
      pos: 0,
      text: "X",
      baseServerSeq: base,
      opId: uuidv7(),     // must be CALLED
      clientId: user
    }
  };
}

async function pump(ws, user, count) {
  const snap = await wait(ws, "snapshot");
  let v = snap.snapshot.version;

  for (let i = 0; i < count; i++) {
    ws.send(JSON.stringify(makeInsert(v, user)));
    const ack = await wait(ws, "ack");
    v = ack.version;
  }
  return v;
}


(async () => {

  console.log("CONNECT A & B");
  const a = connect(A);
  const b = connect(B);

  await Promise.all([
  pump(a, A, 20),
  pump(b, B, 20)
]);

  console.log("FREEZE B");
  b.close();

  console.log("A PUSHES WINDOW+");
  const head = await pump(a, A, WINDOW_PUSH);
  console.log("SERVER HEAD =", head);

  console.log("B RECONNECTS (STALE)");
  const b2 = connect(B);

  const snap = await wait(b2, "snapshot");
  console.log("B RECEIVED SNAPSHOT @", snap.snapshot.version);

  console.log("B TRIES OLD BASE (must fail)");
  b2.send(JSON.stringify(makeInsert("stale_fail", 1, B)));

  const err = await wait(b2, "error");
  console.log("EXPECTED ERROR:", err.code);

  console.log("B RESYNC & CONTINUE");
  await pump(b2, B, AFTER_RESYNC_OPS);

  console.log("STALE SNAPSHOT RESYNC SUCCESS");
  process.exit(0);
})();
