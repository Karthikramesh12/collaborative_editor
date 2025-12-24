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

module.exports = {
    createDocument,
    listDocument,
}