const express = require("express");
const { mkdir, list, read, write, move, del ,stat } = require("./fs.controller.js");

const router = express.Router();

router.get("/:ws/stat", stat);
router.get("/:ws/list", list);
router.get("/:ws/read", read);
router.post("/:ws/write", write);
router.post("/:ws/mkdir", mkdir);
router.post("/:ws/delete", del);
router.post("/:ws/move", move);

module.exports = router;