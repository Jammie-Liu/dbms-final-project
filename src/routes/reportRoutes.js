const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken } = require('../lib/auth');

router.post('/:eventID', verifyToken, reportController.reportEvent);

module.exports = router;