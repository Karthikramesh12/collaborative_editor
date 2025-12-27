const service = require('../service/http.service.js');

async function submitOperation(req, res){
    try{
        const result = await service.submitOperation(req.params.documentId, req.body);
        res.json(result);
    } catch (error){
        if (error.message === "STALE_CLIENT"){
            const snap = await service.getSnapShot(req.params.documentId);
            return res.status(409).json({
                resync: true,
                snapshot: snap
            });
        }

        if (error.message === "INVALID_OP"){
            return res.status(400).json({
                error: error.message
            });
        }

        console.error("error: ", error);
        return res.status(500).json({
            error: "internal server error"
        });
    }
}

async function getSnapShot(req, res){
    try{
        const snap = service.getSnapShot(req.params.documentId);
        res.json(snap);
    } catch (error){
        console.error("Error in fetching snapshot: ", error);
        return res.status(500).json({
            error: error.message
        });
    }
}

module.exports = {
    submitOperation,
    getSnapShot
}