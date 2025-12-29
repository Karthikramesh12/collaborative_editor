const WS = require("ws");

const DOC = "cmjrak2890001eqv0kj8alwpg";
const OWNER = "cmjk59lxc0000eqzsxbvxv0qe";
const EDITOR = "cmjk59lxc0000eqzsxbvxv0qe"; // same editor ACL id
const ATTACKER = "905a368a-da32-402c-80ef-1b6644f4ada0";

const OPS_PER_CLIENT = 600;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connect(user) {
  return new WS(`ws://localhost:3000?documentId=${DOC}&userId=${user}`);
}

function waitSnapshot(ws) {
  return new Promise(res => ws.on("message", m => {
    const msg = JSON.parse(m);
    if (msg.type === "snapshot") res(msg.snapshot);
  }));
}

function waitAck(ws) {
  return new Promise(res => ws.on("message", m => {
    const msg = JSON.parse(m);
    if (msg.type === "ack") res(msg.version);
  }));
}

function randomOp(id, base, user, docLen) {
  const t = Math.random();
  if (t < 0.33 || docLen === 0) {
    return { type:"insert", pos: Math.floor(Math.random()* (docLen+1)), text: "X" };
  }
  if (t < 0.66) {
    const pos = Math.floor(Math.random()*docLen);
    return { type:"delete", pos, length:1 };
  }
  const pos = Math.floor(Math.random()*docLen);
  return { type:"replace", pos, length:1, text:"Y" };
}

function makeMsg(id, base, user, docLen) {
  const o = randomOp(id, base, user, docLen);
  return {
    type:"op",
    op:{
      ...o,
      baseVersion: base,
      opId: id,
      clientId: user
    }
  };
}

async function pump(ws, user, start, count, docLen) {
  let version = (await waitSnapshot(ws)).version;
  for (let i = 0; i < count; i++) {
    const msg = makeMsg(`${user}_${start+i}`, version, user, docLen.value);
    ws.send(JSON.stringify(msg));
    version = await waitAck(ws);
    docLen.value = Math.max(0, docLen.value + (msg.op.type === "insert" ? 1 : msg.op.type === "delete" ? -1 : 0));
  }
  return version;
}

(async () => {

  console.log("OWNER + EDITOR CONNECT");
  const owner = connect(OWNER);
  const editor = connect(EDITOR);

  const ownerLen = { value: 0 };
  const editorLen = { value: 0 };

  console.log("RUNNING 600 OPS EACH");
  const [ov, ev] = await Promise.all([
    pump(owner, OWNER, 0, OPS_PER_CLIENT, ownerLen),
    pump(editor, EDITOR, 0, OPS_PER_CLIENT, editorLen)
  ]);

  console.log("CRASH OWNER");
  owner.close();
  await sleep(300);

  console.log("RECONNECT OWNER");
  const owner2 = connect(OWNER);
  const snap = await waitSnapshot(owner2);

  console.log("SNAPSHOT VERSION", snap.version, "CONTENT LEN", snap.content.length);

  console.log("CONTINUE 100 MORE OPS");
  await pump(owner2, OWNER, OPS_PER_CLIENT, 100, ownerLen);

  console.log("ATTACKER CONNECT");
  const attacker = connect(ATTACKER);

  attacker.on("close", code => {
    if (code !== 4004) throw new Error("ATTACKER NOT BLOCKED");
    console.log("ATTACKER BLOCKED");
    process.exit(0);
  });

})();
