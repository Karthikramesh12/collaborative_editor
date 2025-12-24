const express = require('express');
const { createDocument, listDocument } = require('../controllers/document.controller.js');
const { requireAuth } = require('../../../middleware/auth.middleware.js');

const router = express.Router()

router.post('/' ,requireAuth ,createDocument);
router.get('/' ,requireAuth ,listDocument);

module.exports = router;