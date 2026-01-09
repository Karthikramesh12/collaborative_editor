const prisma = require('../../config/prisma.js');
const path = require("path");
const fs = require("fs/promises");

async function exists(p){
    try{
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function materializeWorkspace(workspaceId){
    const files = await prisma.file.findMany({
        where:{
            workspaceId: workspaceId
        },
        include: {
            workspace: true
        }
    });

    for (const f of files){
        const abs = path.join(f.workspace.mountPath, "files", f.path);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        if (!(await exists(abs))){
            await fs.writeFile(abs, "", "utf8");
        }
    }
}

module.exports = { materializeWorkspace };