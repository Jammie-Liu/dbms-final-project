const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../lib/auth');

router.get('/', verifyToken, notificationController.getNotifications);
router.patch('/:notificationID/read', verifyToken, notificationController.markAsRead);
router.patch('/read-all', verifyToken, notificationController.markAllAsRead);

module.exports = router;