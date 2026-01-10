const chokidar = require("chokidar");
const path = require("path");
const prisma = require("../../config/prisma.js");
const engine = require("../../realtime/engine/collab.engin.js");
const fs = require("fs/promises");
const crypto = require("crypto");

const pendingUnlinks = new Map(); // rename detection

async function watchWorkspace(workspaceId){
  const ws = await prisma.workspace.findUnique({ where:{ id:workspaceId }});
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");

  const root = path.join(ws.mountPath, "files");

  const watcher = chokidar.watch(root,{ ignoreInitial:true });

  /* ===================== CHANGE ===================== */
  watcher.on("change", async absPath => {
    const rel = path.relative(root, absPath);

    const file = await prisma.file.findFirst({ where:{ workspaceId, path:rel }});
    if (!file) return;

    const text = await fs.readFile(absPath, "utf8");
    await engine.absorbFsContent(file.id, text);

    const hash = crypto.createHash("sha1").update(text).digest("hex");

    await prisma.file.update({
      where:{ id:file.id },
      data:{ currentHash:hash }
    });
  });

  /* ===================== DELETE ===================== */
watcher.on("unlink", async absPath => {
  const rel = path.relative(root, absPath);

  const file = await prisma.file.findFirst({ where:{ workspaceId, path:rel }});
  if (!file) return;

  await engine.dropFile(file.id);

  await prisma.file.delete({ where:{ id:file.id }});
});


  /* ===================== CREATE / RENAME ===================== */
  watcher.on("add", async absPath => {
  const rel = path.relative(root, absPath);
  if (rel.startsWith(".")) return;

  const text = await fs.readFile(absPath, "utf8");
  const hash = crypto.createHash("sha1").update(text).digest("hex");

  const file = await prisma.file.upsert({
    where:{ workspaceId_path:{ workspaceId, path:rel }},
    update:{ currentHash:hash },
    create:{ workspaceId, path:rel, currentHash:hash, version:0 }
  });

  await prisma.fileSnapshot.create({
    data:{ fileId:file.id, version:file.version, hash, content:text }
  });

  await engine.absorbFsContent(file.id, text);
});

}

module.exports = { watchWorkspace };
