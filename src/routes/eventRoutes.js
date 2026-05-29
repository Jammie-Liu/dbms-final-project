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
router.put('/:eventID/review', verifyToken, eventController.updateReview);
router.post('/:eventID/history', verifyToken, eventController.recordHistory);
const { upload } = require('../lib/cloudinary');

// 圖片上傳 API
router.post('/upload-image', verifyToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '請選擇圖片' });
  }
  res.json({ imageURL: req.file.path }); // Cloudinary 回傳的 URL
});

module.exports = router;