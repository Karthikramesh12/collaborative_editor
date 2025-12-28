const WebSocket = require("ws");

const DOC = "heartbeat-test";

const A = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);
const B = new WebSocket(`ws://localhost:3000/?documentId=${DOC}`);

A.on("open", () => console.log("A connected"));
B.on("open", () => console.log("B connected"));

A.on("close", () => console.log("A closed"));
B.on("close", () => console.log("B closed"));

/*
  Simulate zombie tab:
  Stop sending data from B without closing TCP.
*/
setTimeout(() => {
  console.log("B ENTERS ZOMBIE STATE");
  B.pause();                 // stop all IO
  B._socket.pause();         // freeze TCP
}, 3000);

/*
  Keep A alive
*/
setInterval(() => {
  if (A.readyState === WebSocket.OPEN) {
    A.send(JSON.stringify({ type: "ping" }));
  }
}, 2000);
