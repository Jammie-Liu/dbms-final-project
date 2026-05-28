const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../lib/auth');

// 所有 admin 路由都要驗證且是 admin role
router.use(verifyToken, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '無權限' });
  next();
});

router.get('/events/:eventID/audit-log', adminController.getAuditLog);
router.get('/events/pending', adminController.getPendingEvents);      // 待審核
router.get('/events/reported', adminController.getReportedEvents);    // 被檢舉
router.get('/events/reported-success', adminController.getReportedSuccessEvents);
router.get('/events/:eventID/reports', adminController.getReportsByEvent);
router.get('/events/approved', adminController.getApprovedEvents);    // 已通過
router.get('/events/rejected', adminController.getRejectedEvents);    // 退件
router.patch('/events/:eventID/audit', adminController.auditEvent);   // 審核結果
router.patch('/reports/:reportID/verify', adminController.verifyReport); // 確認檢舉是否屬實
router.post('/events/:eventID/confirm-report', adminController.confirmReport);

module.exports = router;