const prisma = require('../../../config/prisma.js');

async function createDocument(userId, title) {
    return prisma.document.create({
        data:{
            title,
            ownerId: userId,
            content: "",
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
    // 1. Check if owner is actually the owner
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

    // 2. Check if target user is already an editor
    const existingEditor = await prisma.editor.findFirst({
        where: {
            documentId,
            userId: targetUserId
        }
    });

    if (existingEditor) {
        throw new Error("USER_ALREADY_EDITOR");
    }

    // 3. Create the invitation
    return prisma.editor.create({
        data: {
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

async function updateEditor(ownerId, targetUserId, documentId, role) {
    // 1. Check if the requester is the owner
    const owner = await prisma.editor.findFirst({
        where: {
            documentId,
            userId: ownerId,
            role: "OWNER"
        }
    });
    if (!owner) {
        throw new Error("NOT_OWNER");
    }

    // 2. Prevent owner from changing their own role
    if (ownerId === targetUserId) {
        throw new Error("CANNOT_CHANGE_OWNER_ROLE");
    }

    // 3. Prevent changing role to OWNER
    if (role === "OWNER") {
        throw new Error("CANNOT_ASSIGN_OWNER_ROLE");
    }

    // 4. Check if target user exists as an editor
    const targetEditor = await prisma.editor.findFirst({
        where: {
            documentId,
            userId: targetUserId
        }
    });
    
    if (!targetEditor) {
        throw new Error("USER_NOT_EDITOR"); // Add this check!
    }

    // 5. Now update the editor
    return prisma.editor.update({
        where: { 
            documentId_userId: { 
                documentId, 
                userId: targetUserId 
            } 
        },
        data: { role }
    });
};

async function deleteEditor(ownerId, documentId, targetUserId) {
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

    if(ownerId === targetUserId){
        throw new Error("NOT_ALLOWED")
    }

    const editor = await prisma.editor.findFirst({
        where:{
            documentId,
            userId: targetUserId,
        }
    });
    if (!editor){
        throw new Error("USER_NOT_FOUND");
    }

    return prisma.editor.delete({
        where:{ documentId_userId: {documentId, userId:targetUserId } }
    });
};

async function deleteDocument(ownerId, documentId) {
    const owner = await prisma.editor.findFirst({
        where:{
            documentId,
            userId: ownerId,
            role: "OWNER"
        }
    });
    if(!owner){
        throw new Error("NOT_OWNER");
    }

    return prisma.document.delete({
        where:{
            id: documentId
        }
    });
}

module.exports = {
    createDocument,
    inviteEditors, 
    listEditors, 
    updateEditor, 
    deleteEditor,
    listMyDocuments,
    deleteDocument,
}
