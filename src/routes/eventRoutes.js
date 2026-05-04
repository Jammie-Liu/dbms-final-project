const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken } = require('../lib/auth');

// 公開路由
router.get('/', eventController.getEvents);          // 主頁活動列表（有權重排序）
router.get('/search', eventController.searchEvents); // 關鍵字/條件搜尋
router.get('/:eventID', eventController.getEventDetail);

// 需要登入
router.post('/', verifyToken, eventController.createEvent);
router.put('/:eventID', verifyToken, eventController.updateEvent);
router.patch('/:eventID/cancel', verifyToken, eventController.cancelEvent);
router.post('/:eventID/review', verifyToken, eventController.addReview);
router.post('/:eventID/history', verifyToken, eventController.recordHistory);

module.exports = router;