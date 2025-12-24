const prisma = require('../../../config/prisma.js');

async function createDocument(userId, title) {
    return prisma.document.create({
        data:{
            title,
            ownerId: userId,
            editors:{
                create:{ userId, role: "OWNER"}
            }
        }
    });
}

async function listMyDocuments(userId) {
    return prisma.document.findMany({
        where:{ editors: { some: { userId } }}
    });
}

async function inviteEditors(ownerId, documentId, targetUserId, role) {
    const owner = await prisma.editor.findFirst({
        where: {
            documentId,
            userId: ownerId,
            role: "OWNER"
        }
    });

    if (!owner){
        throw new Error("NOT_OWNER");
    }

    return prisma.editor.create({
        data:{
            documentId,
            userId: targetUserId,
            role,
            invitedBy: ownerId
        }
    });
};

async function listEditors(documentId, userId) {
    const member = await prisma.editor.findFirst({
        where:{
            documentId,
            userId,
        }
    });
    if (!member){
        throw new Error("FORBIDDEN");
    }

    return prisma.editor.findMany({
        where:{ documentId }
    });
}

async function updateEditor(ownerId, targetUserId, documentId, role){
    const owner = await prisma.editor.findFirst({
        where:{
            documentId,
            userId: ownerId,
            role: "OWNER"
        }
    });
    if (!owner) {
        throw new Error("NOT_OWNER");
    }

    return prisma.editor.update({
        where:{ documentId_userId: {documentId,userId: targetUserId } },
        data: { role }
    });
};

async function deleteEditot(ownerId, documentId, targetUserId) {
    const owner = await prisma.editor.findFirst({
        where:{
            documentId,
            userId: ownerId,
            role: "OWNER"
        }
    });

    if (!owner) {
        throw new Error("NOT_OWNER");
    }

    return prisma.editor.delete({
        where:{ documentId_userId: {documentId, userId:targetUserId } }
    });
};

module.exports = {
    createDocument,
    inviteEditors, 
    listEditors, 
    updateEditor, 
    deleteEditot,
    listMyDocuments,
}
