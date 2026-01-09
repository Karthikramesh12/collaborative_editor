const { createWorkspace } = require('../service/workspace.service.js');
const prisma = require('../../../config/prisma.js');

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

module.exports = { createWS };