const express = require("express");
const { createWS, openWorkspace, addWorkspaceMembers, searchUsers, removeMember, getMyWorkspace, getWorkspaceMembers, getWorkspace, deleteWs } = require("../controller/workspace.controller.js");
const { requireAuth } = require("../../../middleware/auth.middleware.js");

const router = express.Router();

router.post("/", requireAuth, createWS);
router.get("/:id/open", requireAuth, openWorkspace);
router.post("/:id/members", requireAuth, addWorkspaceMembers);
router.get("/search", requireAuth, searchUsers);
router.delete("/:id/remove", requireAuth, removeMember);
router.get("/", requireAuth, getMyWorkspace);
router.get("/:id/members", requireAuth, getWorkspace);
router.delete("/:id", requireAuth, deleteWs);

module.exports = router;