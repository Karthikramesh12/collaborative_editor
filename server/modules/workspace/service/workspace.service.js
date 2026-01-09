const prisma = require("../../../config/prisma.js");
const fs = require("fs/promises");
const path = require("path");
const { materializeWorkspace } = require("../workspace.bootstrap.js");

const ROOT = '/home/karthik/workspaces';

async function createWorkspace(ownerId, name){
    const ws = await prisma.workspace.create({
        data: {
            ownerId: ownerId,
            name: name,
            mountPath: ''
        }
    });

    const mountPath = path.join(ROOT, ws.id);
    await fs.mkdir(path.join(mountPath, 'files'), { recursive: true });
    await fs.mkdir(path.join(mountPath, '.meta'), { recursive: true });

    await materializeWorkspace(ws.id);

    const updated = await prisma.workspace.update({
        where: {
            id: ws.id
        },
        data: {
            mountPath: mountPath
        }
    });

    return updated;
}

module.exports = { createWorkspace };