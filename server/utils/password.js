const bcrypt = require("bcrypt");

exports.hash = password => bcrypt.hash(password, 12);
exports.verify = (password, hash) => bcrypt.compare(password, hash); 