const engine = require("../engine/collab.engin.js");
const prisma = require("../../config/prisma.js");
const fs = require("fs/promises");
const path = require("path");

const FILE_ID = "f1";   // must exist in DB
const WS_ID = "__fs__";

async function main() {
  const file = await prisma.file.findUnique({
    where: { id: FILE_ID },
    include: { workspace: true }
  });

  if (!file) throw new Error("FILE NOT FOUND");

  const abs = path.join(file.workspace.mountPath, "files", file.path);

  console.log("Injecting engine op → disk + oplog");

  const res = await engine.submitOperation(FILE_ID, {
    opId: "engine-test-1",
    clientId: WS_ID,
    baseVersion: file.version,
    type: "insert",
    pos: 0,
    text: "ENGINE\n"
  }, WS_ID);

  console.log("Engine returned:", res);

  const disk = await fs.readFile(abs, "utf8");
  console.log("\nDisk content:");
  console.log(disk);

  const oplogs = await prisma.fileOplogs.findMany({
    where: { fileId: FILE_ID },
    orderBy: { serverSeq: "asc" }
  });

  console.log("\nOplogs:");
  for (const o of oplogs) {
    console.log(o.serverSeq, o.op);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
