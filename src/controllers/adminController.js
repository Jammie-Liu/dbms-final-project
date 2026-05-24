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

// 取得被檢舉的活動（需二次審核）
exports.getReportedEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.username AS organizerName,
        GROUP_CONCAT(DISTINCT r.reason) AS reportReasons,
        GROUP_CONCAT(DISTINCT r.detail SEPARATOR ' | ') AS reportDetails,
        COUNT(r.reportID) AS reportCount
       FROM Events e
       JOIN Users u ON e.organizerID = u.userID
       JOIN Reports r ON e.eventID = r.eventID
       WHERE r.isVerified IS NULL
       GROUP BY e.eventID
       ORDER BY reportCount DESC`
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