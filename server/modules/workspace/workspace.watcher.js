const chokidar = require("chokidar");
const path = require("path");
const prisma = require("../../config/prisma.js");
const engine = require("../../realtime/engine/collab.engin.js");
const fs = require("fs");

async function watchWorkspace(workspaceId){
    const ws = await prisma.workspace.findFirst({
        where:{
            id: workspaceId
        }
    });

    if (!ws){
        throw new Error("WORKSPACE_NOT_FOUND");
    }

    const root = path.join(ws.mountPath, "files");

    const watcher = chokidar.watch(root, { ignoreInitial: true });

    watcher.on("change", async absPath => {
        const rel = absPath.replace(root + "/", "");
        const file = await prisma.file.findFirst({
            where:{
                workspaceId,
                path: rel
            }
        });

        if (!file){
            return;
        }

        const content = fs.readFileSync(absPath, "utf8");

        await engine.absorbFsContent(file.id, content);
    });
};

module.exports = { watchWorkspace };
