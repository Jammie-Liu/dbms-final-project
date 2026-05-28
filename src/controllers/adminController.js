const db = require('../lib/mysql');

// 取得待審核活動
exports.getPendingEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.username AS organizerName
       FROM Events e JOIN Users u ON e.organizerID = u.userID
       WHERE e.auditStatus = 'unapproved'
       ORDER BY e.publishedAt ASC`
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 取得已通過的活動
exports.getApprovedEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.username AS organizerName
       FROM Events e JOIN Users u ON e.organizerID = u.userID
       WHERE e.auditStatus = 'approved'
       ORDER BY e.publishedAt DESC`
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 取得退件的活動
exports.getRejectedEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.username AS organizerName
       FROM Events e JOIN Users u ON e.organizerID = u.userID
       WHERE e.auditStatus = 'rejected'
       ORDER BY e.publishedAt DESC`
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 審核活動
exports.auditEvent = async (req, res) => {
  const { eventID } = req.params;
  const { result, rejectReason, comment, auditReason } = req.body;
  const adminID = req.user.userID;

  try {
    // 查目前是第幾次審核
    const [countRows] = await db.query(
      'SELECT COUNT(*) AS count FROM Audit_Log WHERE eventID = ?',
      [eventID]
    );
    const ordinal_num = countRows[0].count + 1;

    // 檢查是否超過重審上限（3次）
    if (ordinal_num > 3) {
      return res.status(400).json({ message: '此活動已達重審上限，無法再審核' });
    }

    // 取得活動資訊（標題 + 主辦人ID）
    const [eventRows] = await db.query(
      'SELECT title, organizerID FROM Events WHERE eventID = ?',
      [eventID]
    );
    if (eventRows.length === 0) {
      return res.status(404).json({ message: '活動不存在' });
    }
    const { title, organizerID } = eventRows[0];

    // 更新活動審核狀態
    await db.query(
      `UPDATE Events SET
        auditStatus = ?,
        status = ?,
        rejectReason = ?,
        reaudit_count = ?
       WHERE eventID = ?`,
      [result, result === 'approved' ? 'approved' : 'rejected',
       rejectReason || null, ordinal_num, eventID]
    );

    // 如果是被檢舉的審核，更新 Reports
    if (auditReason === 'reported') {
      await db.query(
        `UPDATE Reports SET isVerified = ? WHERE eventID = ?`,
        [result === 'rejected' ? 1 : 0, eventID]
      );
    }

    // 寫入 Audit_Log
    await db.query(
      `INSERT INTO Audit_Log
        (eventID, adminID, result, audit_reason, comment, ordinal_num, rejectReason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventID, adminID, result, auditReason || 'general', comment || null, ordinal_num, rejectReason || null]
    );

    // 通知主辦方
    const notifMessage = result === 'approved'
      ? `🎉 你的活動「${title}」已審核通過！`
      : `❗️ 你的活動「${title}」審核未通過，原因：${rejectReason}`;

    await db.query(
      `INSERT INTO Notifications (userID, eventID, message)
       VALUES (?, ?, ?)`,
      [organizerID, eventID, notifMessage]
    );

    res.json({ message: '審核完成' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 確認檢舉是否屬實
exports.verifyReport = async (req, res) => {
  const { reportID } = req.params;
  const { isVerified } = req.body;

  try {
    await db.query(
      'UPDATE Reports SET isVerified = ? WHERE reportID = ?',
      [isVerified ? 1 : 0, reportID]
    );
    res.json({ message: '檢舉審核完成' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 取得審核歷史
exports.getAuditLog = async (req, res) => {
  const { eventID } = req.params;
  try {
    const [logs] = await db.query(
      `SELECT al.*, u.username AS adminName
       FROM Audit_Log al
       JOIN Users u ON al.adminID = u.userID
       WHERE al.eventID = ?
       ORDER BY al.ordinal_num ASC`,
      [eventID]
    );
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 取得被檢舉活動的所有檢舉列表
exports.getReportsByEvent = async (req, res) => {
  const { eventID } = req.params;
  try {
    const [reports] = await db.query(
      `SELECT r.*, u.username AS reporterName
       FROM Reports r
       JOIN Users u ON r.reporterID = u.userID
       WHERE r.eventID = ?
       ORDER BY r.createdAt ASC`,
      [eventID]
    );
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 審核單筆檢舉（屬實/不實）
exports.verifyReport = async (req, res) => {
  const { reportID } = req.params;
  const { isVerified } = req.body;
  const adminID = req.user.userID;

  try {
    await db.query(
      'UPDATE Reports SET isVerified = ?, adminID = ? WHERE reportID = ?',
      [isVerified ? 1 : 0, adminID, reportID]
    );
    res.json({ message: '審核完成' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 檢查是否達到檢舉成立條件，並執行檢舉成立
exports.confirmReport = async (req, res) => {
  const { eventID } = req.params;
  const adminID = req.user.userID;

  try {
    // 查詢檢舉統計
    const [stats] = await db.query(
      `SELECT
        COUNT(*) AS totalReports,
        SUM(CASE WHEN isVerified = 1 THEN 1 ELSE 0 END) AS verifiedReports
       FROM Reports WHERE eventID = ?`,
      [eventID]
    );

    const { totalReports, verifiedReports } = stats[0];

    if (totalReports < 5 || verifiedReports < 3) {
      return res.status(400).json({
        message: `條件未達成（總檢舉 ${totalReports}/5，屬實 ${verifiedReports}/3）`
      });
    }

    // 取得主辦人 ID
    const [eventRows] = await db.query(
      'SELECT organizerID, title FROM Events WHERE eventID = ?', [eventID]
    );
    const { organizerID, title } = eventRows[0];

    // 標記活動為被檢舉成功（不顯示給使用者）
    await db.query(
      `UPDATE Events SET isReported = 1, status = 'cancelled' WHERE eventID = ?`,
      [eventID]
    );

    // 封鎖主辦人發活動權限 1 年
    const banUntil = new Date();
    banUntil.setFullYear(banUntil.getFullYear() + 1);
    await db.query(
      'UPDATE Users SET isBanned = 1, banUntil = ? WHERE userID = ?',
      [banUntil, organizerID]
    );

    // 通知主辦人
    await db.query(
      `INSERT INTO Notifications (userID, eventID, message) VALUES (?, ?, ?)`,
      [organizerID, eventID,
       `⚠️ 你的活動「${title}」因檢舉屬實已被下架，發布活動權限暫停 1 年`]
    );

    res.json({ message: '檢舉核實成功，活動已下架，主辦人已被封鎖' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 取得被檢舉成功的活動
exports.getReportedSuccessEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.username AS organizerName,
        COUNT(r.reportID) AS reportCount,
        SUM(CASE WHEN r.isVerified = 1 THEN 1 ELSE 0 END) AS verifiedCount
       FROM Events e
       JOIN Users u ON e.organizerID = u.userID
       LEFT JOIN Reports r ON e.eventID = r.eventID
       WHERE e.isReported = 1
       GROUP BY e.eventID
       ORDER BY e.publishedAt DESC`
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 更新 getReportedEvents：只顯示尚未被檢舉成立的活動
exports.getReportedEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.username AS organizerName,
        GROUP_CONCAT(DISTINCT r.reason) AS reportReasons,
        GROUP_CONCAT(DISTINCT r.detail SEPARATOR ' | ') AS reportDetails,
        COUNT(r.reportID) AS reportCount,
        SUM(CASE WHEN r.isVerified = 1 THEN 1 ELSE 0 END) AS verifiedCount
       FROM Events e
       JOIN Users u ON e.organizerID = u.userID
       JOIN Reports r ON e.eventID = r.eventID
       WHERE e.isReported = 0
       GROUP BY e.eventID
       HAVING COUNT(r.reportID) > 0
       ORDER BY reportCount DESC`
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};