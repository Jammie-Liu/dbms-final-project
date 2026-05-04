const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../lib/auth');  // 之後會建這個

// 不需要登入的路由
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// 需要登入的路由（加上 verifyToken middleware）
router.post('/preferences', verifyToken, userController.setPreferences);
router.get('/preferences', verifyToken, userController.getPreferences);
router.get('/favorites', verifyToken, userController.getFavorites);
router.post('/favorites/:eventID', verifyToken, userController.addFavorite);
router.delete('/favorites/:eventID', verifyToken, userController.removeFavorite);
router.get('/favorites/folders', verifyToken, userController.getFolders);
router.post('/favorites/folders', verifyToken, userController.createFolder);
router.get('/history', verifyToken, userController.getHistory);
router.get('/my-events', verifyToken, userController.getMyEvents);

module.exports = router;