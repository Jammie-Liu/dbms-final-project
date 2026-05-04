const db = require('../lib/mysql');

exports.reportEvent = async (req, res) => {
  const { eventID } = req.params;
  const { reason } = req.body;
  const reporterID = req.user.userID;

  try {
    // 新增檢舉
    await db.query(
      'INSERT INTO Reports (reporterID, eventID, reason) VALUES (?, ?, ?)',
      [reporterID, eventID, reason]
    );

    // 檢查是否達到「被檢舉 5 次且屬實 3 次」的條件 → 封鎖 1 年
    const [reportStats] = await db.query(
      `SELECT
         COUNT(*) AS totalReports,
         SUM(CASE WHEN isVerified = 1 THEN 1 ELSE 0 END) AS verifiedReports
       FROM Reports WHERE eventID = ?`,
      [eventID]
    );

    const { totalReports, verifiedReports } = reportStats[0];
    if (totalReports >= 5 && verifiedReports >= 3) {
      const [eventRows] = await db.query('SELECT organizerID FROM Events WHERE eventID = ?', [eventID]);
      if (eventRows.length > 0) {
        const banUntil = new Date();
        banUntil.setFullYear(banUntil.getFullYear() + 1);
        await db.query(
          'UPDATE Users SET isBanned = 1, banUntil = ? WHERE userID = ?',
          [banUntil, eventRows[0].organizerID]
        );
      }
    }

    res.status(201).json({ message: '檢舉已送出' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};