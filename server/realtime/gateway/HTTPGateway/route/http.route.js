const express = require('express');
const { submitOperation, getSnapShot } = require("../controller/http.controller.js");

const router = express.Router();

router.post('/op/:documentId', submitOperation);
router.get('/snapshot/:documentId', getSnapShot);

module.exports = router;