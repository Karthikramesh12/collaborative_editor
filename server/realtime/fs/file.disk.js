const fs = require("fs/promises");
const path = require("path");
const prisma = require("../../config/prisma.js");

async function persistToDisk(fileId, content) {
    const file = await prisma.file.findUnique({
        where: {
            id: fileId
        },
        include:{
            workspace: true
        }
    });

    const abs = path.join(file.workspace.mountPath, "files", file.path);
    await fs.writeFile(abs, content, "utf8");

    await prisma.file.update({
        where: {
            id: fileId
        },
        data: {
            version: file.version + 1
        }
    });
};

module.exports = { persistToDisk };