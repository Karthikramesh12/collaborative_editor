const service = require('../services/document.service.js');

async function createDocument(req, res) {
    try{
        const { title } = req.body;

        if(!title){
            return res.status(400).json({
                success: false,
                message: "title is required"
            });
        }

        const doc = await service.createDocument(req.user.id, title);

        return res.status(201).json({
            success: true,
            data: doc,
        });
    } catch (error){
        console.error("Error in creating document: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

async function listDocument(req, res) {
    try{
        const list = await service.listMyDocuments(req.user.id);

        if (!list){
            return res.status(400).json({
                success: false,
                message: "no documents were made"
            });
        }

        return res.status(200).json({
            success: true,
            count: list.length,
            data: list,
        });
    } catch (error){
        console.error("Error in fetching documents: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

async function invite(req, res) {
    try {
        const { targetUserId, role } = req.body;
        const documentId = req.params.id;

        if (!documentId || !targetUserId || !role) {
            return res.status(400).json({
                success: false,
                message: "missing fields"
            });
        }

        // Prevent inviting yourself
        if (targetUserId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "Cannot invite yourself"
            });
        }

        const invite = await service.inviteEditors(req.user.id, documentId, targetUserId, role);

        return res.status(200).json({
            success: true,
            data: invite,
        });
    } catch (error) {
        if (error.message === 'NOT_OWNER') {
            return res.status(401).json({  // Fixed typo: staus → status
                success: false,
                message: "unauthorized"
            });
        }
        
        if (error.message === 'USER_ALREADY_EDITOR') {
            return res.status(400).json({
                success: false,
                message: "User is already an editor"
            });
        }
        
        console.error("Error in inviting editor: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

async function listEditors(req, res) {
    try{
        const docunmentId = req.params.id;

        if (!docunmentId){
            return res.staus(400).json({
                success: false,
                message: "missing document id"
            });
        }

        result = await service.listEditors(docunmentId, req.user.id);

        return res.status(200).json({
            success: true,
            count: result.length,
            data: result
        });
    } catch (error){

        if(error.message === "FORBIDDEN"){
            return res.status(401).json({
                success: false,
                message: "unauthorized"
            });
        }

        console.error("Error in fetching editors: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

async function updateEditor(req, res) {
    try {
        const { role } = req.body;
        const documentId = req.params.id;
        const targetUserId = req.params.userId;

        if (!documentId || !targetUserId || !role) {
            return res.status(400).json({
                success: false,
                message: "missing or invalid fields"
            });
        }

        const update = await service.updateEditor(req.user.id, targetUserId, documentId, role);

        return res.status(200).json({
            success: true,
            data: update
        });
    } catch (error) {
        if (error.message === "NOT_OWNER") {
            return res.status(403).json({ // Use 403 for forbidden
                success: false,
                message: "unauthorized"
            });
        }
        if (error.message === "CANNOT_CHANGE_OWNER_ROLE") {
            return res.status(400).json({
                success: false,
                message: "Cannot change owner's role"
            });
        }
        if (error.message === "CANNOT_ASSIGN_OWNER_ROLE") {
            return res.status(400).json({
                success: false,
                message: "Only one owner per document"
            });
        }
        if (error.message === "USER_NOT_EDITOR") {
            return res.status(404).json({ // Use 404 for not found
                success: false,
                message: "User is not an editor of this document"
            });
        }
        
        console.error("Error in updating editor: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

async function deleteEditor(req, res) {
    try{
        const documentId = req.params.id;
        const targetEditor = req.params.userId;

        if (!documentId || !targetEditor){
            return res.status(400).json({
                success: false,
                message: "missing or invalid fields"
            });
        }

        const deleted = await service.deleteEditor(req.user.id, documentId, targetEditor);

        return res.status(200).json({
            success: true,
            data: deleted,
        });
    } catch (error){
        if(error.message === "NOT_OWNER"){
            return res.status(401).json({
                success: false,
                message: "unauthorized"
            });
        }
        if (error.message === "NOT_ALLOWED"){
            return res.status(401).json({
                success: false,
                message: "Cannot remove owner of this document"
            });
        }
        if (error.message === "USER_NOT_FOUND"){
            return res.status(401).json({
                success: false, 
                message: "user not found"
            });
        }
        console.error("Error in deleting user: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

async function deleteDoc(req, res) {
    try{
        const documentId = req.params.id;

        if(!documentId){
            return res.status(400).json({
                success: false,
                message: "missing or invalid fields"
            });
        }

        const deleted = await service.deleteDocument(req.user.id, documentId);

        return res.status(200).json({
            success: true,
            data: deleted,
        });
    } catch (error){
        if (error.message === "NOT_OWNER"){
            return res.status(401).json({
                success: false,
                message: "unauthorized"
            });
        }
        console.error("Error in deleting the document: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    createDocument,
    listDocument,
    invite,
    listEditors,
    updateEditor,
    deleteEditor,
    deleteDoc,
}