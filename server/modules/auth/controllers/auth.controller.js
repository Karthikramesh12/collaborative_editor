const auth = require('../services/auth.services.js');

async function signUp (req, res) {
    try{
        const { email, userName, password }  = req.body;

        if(!email || !userName || !password) {
            return res.status(400).json({
                success: false,
                message: "missing fields"
            });
        }

        const user = await auth.signUp(email, password, userName);
        
        return res.status(201).json({
            success: true,
            data:{
                user
            },
        });
    } catch (error){
        if (error.message === "EMAIL_EXISTS"){
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

        const user = await auth.login(email, password);

        return res.status(200).json({
            success: true,
            data:{
                user,
            },
        });
    } catch (error) {
        if (error.message === "INVALID"){
            return res.status(401).json({
                success: false,
                message: "invalid credentials",
            });
        }

        console.error("Error in logging in: ", error);
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