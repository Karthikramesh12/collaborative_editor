const express = require("express");
const { createWS } = require("../controller/workspace.controller.js");
const { requireAuth } = require("../../../middleware/auth.middleware.js");

const router = express.Router();

router.post("/", requireAuth, createWS);

module.exports = router;