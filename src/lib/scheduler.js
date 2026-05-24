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

// 自動刪除過期活動
async function autoDeleteEvents() {
  console.log('🗑️ 執行自動刪除過期活動...');
  try {
    // 刪除前先清除相關資料（避免 foreign key 錯誤）
    // 1. 發布超過 5 年的活動
    const [expiredEvents] = await db.query(`
      SELECT eventID FROM Events
      WHERE publishedAt < NOW() - INTERVAL 5 YEAR
    `);

    // 2. 已取消超過 2 年的活動
    const [cancelledEvents] = await db.query(`
      SELECT eventID FROM Events
      WHERE status = 'cancelled'
      AND updatedAt < NOW() - INTERVAL 2 YEAR
    `);

    const toDelete = [
      ...expiredEvents.map(e => e.eventID),
      ...cancelledEvents.map(e => e.eventID)
    ];

    // 去重複
    const uniqueIDs = [...new Set(toDelete)];

    if (uniqueIDs.length === 0) {
      console.log('✅ 沒有需要刪除的活動');
      return;
    }

    console.log(`🗑️ 準備刪除 ${uniqueIDs.length} 筆活動...`);

    for (const eventID of uniqueIDs) {
      // 依序刪除相關資料
      await db.query('DELETE FROM Event_Tag WHERE eventID = ?', [eventID]);
      await db.query('DELETE FROM Notifications WHERE eventID = ?', [eventID]);
      await db.query('DELETE FROM Reports WHERE eventID = ?', [eventID]);
      await db.query('DELETE FROM Reviews WHERE eventID = ?', [eventID]);
      await db.query('DELETE FROM BrowsingHistory WHERE eventID = ?', [eventID]);
      await db.query('DELETE FROM Favorites WHERE eventID = ?', [eventID]);
      await db.query('DELETE FROM Events WHERE eventID = ?', [eventID]);

      console.log(`✅ 已刪除活動 eventID: ${eventID}`);
    }

    console.log(`✅ 自動刪除完成，共刪除 ${uniqueIDs.length} 筆活動`);
  } catch (err) {
    console.error('❌ 自動刪除錯誤:', err);
  }
}

// 每天早上 9 點執行
cron.schedule('0 9 * * *', checkDeadlineReminders, {
  timezone: 'Asia/Taipei'
});

// 每天凌晨 3 點：自動刪除過期活動
cron.schedule('0 3 * * *', autoDeleteEvents, {
  timezone: 'Asia/Taipei'
});

console.log('📅 排程系統已啟動');
console.log('   - 每天 09:00 檢查報名截止提醒');
console.log('   - 每天 03:00 自動刪除過期活動');

module.exports = { checkDeadlineReminders, autoDeleteEvents };