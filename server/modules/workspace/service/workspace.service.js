const prisma = require("../../../config/prisma.js");
const fs = require("fs/promises");
const path = require("path");

const ROOT = '/home/karthik/workspaces';

async function createWorkspace(ownerId, name){
  const ws = await prisma.workspace.create({
    data:{ ownerId, name, mountPath:"PENDING" }
  });

  const mountPath = path.join(ROOT, ws.id);

  await fs.mkdir(path.join(mountPath,"files"), { recursive:true });
  await fs.mkdir(path.join(mountPath,".meta"), { recursive:true });

  const updated = await prisma.workspace.update({
    where:{ id:ws.id },
    data:{ mountPath }
  });

  // mountPath is now valid everywhere// critical – attach live filesystem

  return updated;
}

async function deleteWorkspace(workspaceId) {
    const ws = await prisma.workspace.findUnique({ where:{ id: workspaceId }});
    if (!ws) return;

    // 2. Remove all workspace dependent rows
    await prisma.$transaction([
        prisma.workspaceMember.deleteMany({ where:{ workspaceId }}),
        prisma.fileOplogs.deleteMany({
            where:{ file:{ workspaceId }}
        }),
        prisma.fileSnapshot.deleteMany({
            where:{ file:{ workspaceId }}
        }),
        prisma.file.deleteMany({ where:{ workspaceId }}),
        prisma.workspace.delete({ where:{ id: workspaceId }})
    ]);

    // 3. Remove disk AFTER DB is clean
    if (ws.mountPath) {
        await fs.rm(ws.mountPath, { recursive:true, force:true });
    }
}

module.exports = { createWorkspace, deleteWorkspace };