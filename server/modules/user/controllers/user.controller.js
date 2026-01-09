const service = require('../services/user.services.js');

async function search(req, res) {
    try{
        const query = req.query.q;

        const result = await service.searchUser(query, req.user.id);

        return res.status(200).json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error){
        console.error("Error in searching for users: ", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    search,
}