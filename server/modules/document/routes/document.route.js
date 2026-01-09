const express = require('express');
const { createDocument, listDocument, invite, listEditors, updateEditor, deleteEditor, deleteDoc } = require('../controllers/document.controller.js');
const { requireAuth } = require('../../../middleware/auth.middleware.js');

const router = express.Router()

router.post('/' ,requireAuth ,createDocument);
router.get('/' ,requireAuth ,listDocument);
router.post('/:id/invite' ,requireAuth ,invite);
router.get('/:id/editors' ,requireAuth ,listEditors);
router.patch('/:id/editors/:userId' ,requireAuth ,updateEditor);
router.delete('/:id/editors/:userId' ,requireAuth ,deleteEditor);
router.delete('/:id/' ,requireAuth ,deleteDoc);

module.exports = router;