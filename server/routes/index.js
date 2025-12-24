const express = require("express");
const authRoutes = require('../modules/auth/routes/auth.route.js');
const documentRoutes = require('../modules/document/routes/document.route.js');
const router = express.Router();

router.use("/auth", authRoutes);
router.use("/doc", documentRoutes);

module.exports = router;