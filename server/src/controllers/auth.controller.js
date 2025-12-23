const autServices = require('../services/auth.services.js');

async function signUp (req, res) {
    try{
        const { email, userName, password }  = req.body;

        if(!email || !userName || !password) {
            return res.status(400).json({
                success: false,
                message: "missing fields"
            });
        }

        const user = await autServices.signUp(email, userName, password);
        
        return res.status(201).json({
            success: true,
            data:{
                userId: user.id,
                email: user.email,
                userName: user.userName,
            },
        });
    } catch (error){
        if (error.message === "USER_ALREADY_EXISTS"){
            return res.status(409).json({
                success: false,
                message: "user already exists"
            });
        }

        console.error("Error in creating a user", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
}

async function login(req, res) {
    try{
        const { email, password } = req.body;

        if (!email || !password){
            return res.status(400).json({
                success: false,
                message: "missing filds"
            });
        }

        const user = await autServices.login(email, password);

        return res.status(200).json({
            success: true,
            data:{
                id: user.id,
                email: user.email,
                userName: user.userName,
            },
        });
    } catch (error) {
        if (error.message === "INVALID_CREDENTIALS"){
            return res.status(401).json({
                success: false,
                message: "invalid credentials",
            });
        }

        return res.status(500).json({
            success: false,
            message: "internal server error",
        });
    }
}

module.exports = {
    signUp,
    login,
}