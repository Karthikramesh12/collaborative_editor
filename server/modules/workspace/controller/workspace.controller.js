const { createWorkspace, deleteWorkspace } = require('../service/workspace.service.js');
const prisma = require('../../../config/prisma.js');
const { ensureVscode } = require("../workspace.vscode.js");

async function createWS(req, res){
    try{
        const user = await prisma.user.findFirst({
            where:{
                id: req.user.id
            }
        });

        if (!user){
            return res.status(400).json({
                success: false,
                message: "user not found"
            });
        }

        const ws = await createWorkspace(req.user.id, user.name);

        if (!ws){
            return res.status(400).json({
                success: false,
                message: "error in creating a workspace"
            });
        }

        return res.status(201).json({
            success: true,
            data: ws
        });
    } catch (error){
        console.error("Error in creating a workspace: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

async function openWorkspace(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required" });
        }

        const ws = await prisma.workspace.findFirst({
            where: { id },
            include: {
                members: {
                    where: { userId },
                    select: { id: true }
                }
            }
        });

        if (!ws) {
            return res.status(404).json({ success: false, message: "workspace not found" });
        }

        const isOwner = ws.ownerId === userId;
        const isMember = ws.members.length > 0;

        if (!isOwner && !isMember) {
            return res.status(403).json({ success: false, message: "access denied" });
        }

        const server = await ensureVscode(ws.id, ws.mountPath);

        return res.status(200).json({
            success: true,
            data: {
                url: `http://${req.hostname}:${server.port}`
            }
        });

    } catch (error) {
        console.error("openWorkspace failed:", error);
        return res.status(500).json({ success: false, message: "internal server error" });
    }
}

async function addWorkspaceMembers(req, res) {
    try{
        const { id } = req.params;
        const { userId, role = "EDITOR" } = req.body;
        
        const ws = await prisma.workspace.findFirst({
            where:{
                id: id
            }
        });

        if (!ws){
            return res.status(400).json({
                success: false,
                message: "workspace not found"
            });
        }

        if (ws.ownerId !== req.user.id){
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const result = await prisma.workspaceMember.create({
            data:{
                workspaceId: id,
                userId: userId,
                role: role
            }
        });

        return res.status(200).json({
            success: true,
            message: "added the user",
            data: result
        });
    } catch (error){
        console.error("Error in creating a member: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

// GET /api/users/search?q=
async function searchUsers(req, res) {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ success:false, message:"query required" });

    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: q, mode: 'insensitive' }},
                { email:{ contains: q, mode: 'insensitive' }}
            ]
        },
        select: { id:true, name:true, email:true, avatarUrl:true }
    });

    return res.json({ success:true, data: users });
}

async function removeMember(req, res){
    try{
        const { id, userId } = req.body;

        const ws = await prisma.workspace.findFirst({
            where:{
                id: id
            }
        });

        if (!ws){
            return res.status(400).json({
                success: false,
                message: "workspace not found"
            });
        }

        if (ws.ownerId !== req.user.id){
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const result = await prisma.workspaceMember.delete({
    where: {
        workspaceId_userId: {
            workspaceId: id,
            userId: userId
        }
    }
});


        return res.status(200).json({
            success: true,
            message: "successfully removed the user from workspace members",
            data: result,
        });
    } catch (error){
        console.error("Error in removing the user from workspace members: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

async function getMyWorkspace(req, res){
    try{
        const userId = req.user.id;

        const data = await prisma.workspace.findMany({
            where:{
                OR:[
                    { ownerId: userId},
                    { members: { some: { userId }}}
                ]
            },
            include: {
                members: {
                    include:{
                        user:{ select: { name: true, email: true }}
                    }
                }
            }
        });

        if (!data){
            return res.status(400).json({
                success: false,
                message: "workspace not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: data
        });
    } catch (error){
        console.error("Error in fetching the user workspaces: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

// GET /api/workspace/:id/members
async function getWorkspaceMembers(req,res){
    const { id } = req.params;
    const userId = req.user.id;

    const allowed = await prisma.workspace.findFirst({
        where:{
            id,
            OR:[
                { ownerId:userId },
                { members:{ some:{ userId }}}
            ]
        }
    });

    if (!allowed) return res.status(403).json({ success:false });

    const members = await prisma.workspaceMember.findMany({
        where:{ workspaceId:id },
        include:{ user:{ select:{ id:true,name:true,email:true,avatarUrl:true }}}
    });

    return res.json({ success:true, data: members });
}

async function getWorkspace(req, res) {
    try{
        const { id } = req.params;
        const userId = req.user.id;
    
        const ws = await prisma.workspace.findFirst({
            where: {
                id,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } }
                ]
            },
            include: {
                owner: { select:{ id:true, name:true, email:true }},
                members: {
                    include: { user:{ select:{ id:true, name:true, email:true, avatarUrl:true }}}
                },
                files: true
            }
        });
    
        if (!ws) {
            return res.status(404).json({
                success:false,
                message:"workspace not found or access denied"
            });
        }
    
        return res.status(200).json({ success:true, data: ws });
    } catch (error){
        console.error("Error in fetching the workspace: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

async function deleteWs(req, res) {
    try{
        const { id } = req.params;

        const ws = await prisma.workspace.findFirst({
            where: {
                id: id
            }
        });

        if (!ws){
            return res.status(400).json({
                success: false,
                message: "workspace not found"
            });
        }

        if (ws.ownerId !== req.user.id){
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        await deleteWorkspace(id);

        return res.status(200).json({
            success: true,
            message: "successfully deleted workspace"
        });
    } catch (error){
        console.error("Error in deleting the workspace: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

module.exports = { createWS, openWorkspace, addWorkspaceMembers, searchUsers, removeMember, getMyWorkspace, getWorkspaceMembers, getWorkspace, deleteWs };