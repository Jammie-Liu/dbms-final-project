const cron = require('node-cron');
const db = require('./mysql');
require('dotenv').config();

async function checkDeadlineReminders() {
  console.log('🔔 執行報名截止提醒檢查...');

  try {
    // 找出明天截止報名的活動，且有人收藏的
    const [rows] = await db.query(`
      SELECT DISTINCT
        e.eventID,
        e.title,
        f.userID
      FROM Events e
      JOIN Favorites f ON e.eventID = f.eventID
      WHERE
        e.status = 'approved'
        AND e.auditStatus = 'approved'
        AND e.registrationDeadline IS NOT NULL
        AND DATE(e.registrationDeadline) = DATE(NOW() + INTERVAL 1 DAY)
    `);

    if (rows.length === 0) {
      console.log('✅ 沒有需要提醒的活動');
      return;
    }

    // 批次新增通知
    for (const row of rows) {
      // 避免重複通知（同一天同一活動同一使用者只發一次）
      const [existing] = await db.query(
        `SELECT notificationID FROM Notifications
         WHERE userID = ? AND eventID = ?
         AND DATE(createdAt) = CURDATE()`,
        [row.userID, row.eventID]
      );

      if (existing.length === 0) {
        await db.query(
          `INSERT INTO Notifications (userID, eventID, message)
           VALUES (?, ?, ?)`,
          [row.userID, row.eventID, `「${row.title}」報名即將於明天截止，記得趕快報名！`]
        );
        console.log(`✅ 已通知 userID:${row.userID} 活動:${row.title}`);
      }
    }
  } catch (err) {
    console.error('❌ 提醒排程錯誤:', err);
  }
}

// 每天早上 9 點執行
cron.schedule('0 9 * * *', checkDeadlineReminders, {
  timezone: 'Asia/Taipei'
});

console.log('📅 排程系統已啟動，每天 09:00 檢查報名截止提醒');

module.exports = { checkDeadlineReminders };