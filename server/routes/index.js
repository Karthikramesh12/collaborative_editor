const express = require("express");
const authRoutes = require('../modules/auth/routes/auth.route.js');
const documentRoutes = require('../modules/document/routes/document.route.js');
const userRoutes = require('../modules/user/routes/user.route.js');
const router = express.Router();

router.use("/auth", authRoutes);
router.use("/doc", documentRoutes);
router.use("/user", userRoutes);

module.exports = router;