const bcrypt = require("bcrypt");

const SALT = 12;

async function hashPassword(password){
    return bcrypt.hash(password, SALT);
}

async function comparePassword(password, hash){
    return bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    comparePassword
}