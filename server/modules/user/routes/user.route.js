const express = require('express');
const { requireAuth } = require('../../../middleware/auth.middleware.js');
const { search } = require('../controllers/user.controller.js');

const router = express.Router();

router.get('/search', requireAuth, search);

module.exports = router;