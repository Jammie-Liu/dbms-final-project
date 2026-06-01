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

// 取得草稿待審核列表
exports.getPendingDrafts = async (req, res) => {
  try {
    const [drafts] = await db.query(
      `SELECT d.*, e.title AS originalTitle, u.username AS organizerName
       FROM EventDrafts d
       JOIN Events e ON d.eventID = e.eventID
       JOIN Users u ON d.organizerID = u.userID
       WHERE d.auditStatus = 'unapproved'
       ORDER BY d.createdAt ASC`
    );

    // 載入每個草稿的 hashtags
    for (const draft of drafts) {
      const [hashtagRows] = await db.query(
        `SELECT h.hashtag
         FROM Draft_Tag dt
         JOIN Hashtags h
         ON dt.hashtagID = h.hashtagID
         WHERE dt.draftID = ?`,
        [draft.draftID]
      );

      draft.hashtags = hashtagRows.map(row => row.hashtag);
    }

    res.json(drafts);
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
  const { result, rejectReason, comment, auditReason, version } = req.body;
  const adminID = req.user.userID;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 查目前是第幾次審核
    const [countRows] = await db.query(
      'SELECT COUNT(*) AS count FROM Audit_Log WHERE eventID = ?',
      [eventID]
    );
    const ordinal_num = countRows[0].count + 1;

    // 檢查是否超過重審上限（3次）
    if (ordinal_num > 3) {
      await connection.rollback();
      return res.status(400).json({ message: '此活動已達重審上限，無法再審核' });
    }

    // 取得活動資訊（標題 + 主辦人ID）
    const [eventRows] = await connection.query(
      'SELECT version, title, organizerID FROM Events WHERE eventID = ?',
      [eventID]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ message: '活動不存在' });
    }

    if (eventRows[0].version !== version) {
      await connection.rollback();
      return res.status(409).json({
        message: '此活動已被其他管理員審核，請重新整理後再試'
      });
    }
    const { title, organizerID } = eventRows[0];

    // 更新活動審核狀態
    const [updateResult] = await db.query(
      `UPDATE Events SET
        auditStatus = ?,
        status = ?,
        rejectReason = ?,
        reaudit_count = ?,
        version = version + 1
       WHERE eventID = ? AND version = ?`,
      [result, result === 'approved' ? 'approved' : 'rejected',
       rejectReason || null, ordinal_num, eventID, version]
    );

    // 如果 affectedRows = 0，代表已被其他人搶先更新
    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        message: '此活動已被其他管理員審核，請重新整理後再試'
      });
    }

    // 如果是被檢舉的審核，更新 Reports
    if (auditReason === 'reported') {
      await connection.query(
        `UPDATE Reports SET isVerified = ? WHERE eventID = ?`,
        [result === 'rejected' ? 1 : 0, eventID]
      );
    }

    // 寫入 Audit_Log
    await connection.query(
      `INSERT INTO Audit_Log
        (eventID, adminID, result, audit_reason, comment, ordinal_num, rejectReason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventID, adminID, result, auditReason || 'general', comment || null, ordinal_num, rejectReason || null]
    );

    // 通知主辦方
    const notifMessage = result === 'approved'
      ? `🎉 你的活動「${title}」已審核通過！`
      : `❗️ 你的活動「${title}」審核未通過，原因：${rejectReason}`;

    await connection.query(
      `INSERT INTO Notifications (userID, eventID, message)
       VALUES (?, ?, ?)`,
      [organizerID, eventID, notifMessage]
    );

    await connection.commit();
    res.json({ message: '審核完成' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤，操作已復原' });
  } finally {
    connection.release();
  }
};

// 審核草稿
exports.auditDraft = async (req, res) => {
  const { draftID } = req.params;
  const { result, rejectReason, comment } = req.body;
  const adminID = req.user.userID;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [draftRows] = await connection.query(
      'SELECT * FROM EventDrafts WHERE draftID = ?', [draftID]
    );
    if (draftRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '草稿不存在' });
    }

    const draft = draftRows[0];

    if (result === 'approved') {
      // 審核通過：把草稿內容更新到 Events
      await connection.query(
        `UPDATE Events SET
          title = ?, category = ?, description = ?,
          eventTime = ?, eventEndTime = ?, location = ?,
          registrationDeadline = ?, registrationLink = ?,
          imageURL = ?, hasMeal = ?, hasGift = ?, fee = ?,
          auditStatus = 'approved',
          edit_count = edit_count + 1
         WHERE eventID = ?`,
        [draft.title, draft.category, draft.description,
         draft.eventTime, draft.eventEndTime, draft.location,
         draft.registrationDeadline, draft.registrationLink,
         draft.imageURL, draft.hasMeal, draft.hasGift, draft.fee,
         draft.eventID]
      );

      // 先刪除原本活動的 hashtag 關聯
      await connection.query(
        'DELETE FROM Event_Tag WHERE eventID = ?',
        [draft.eventID]
      );

      // 取得草稿 hashtag
      const [draftTags] = await connection.query(
        `SELECT hashtagID
        FROM Draft_Tag
        WHERE draftID = ?`,
        [draftID]
      );

      // 建立新的活動 hashtag 關聯
      for (const tag of draftTags) {
        await connection.query(
          `INSERT INTO Event_Tag (eventID, hashtagID)
          VALUES (?, ?)`,
          [draft.eventID, tag.hashtagID]
        );
      }

      // 通知主辦方
      await connection.query(
        `INSERT INTO Notifications (userID, eventID, message) VALUES (?, ?, ?)`,
        [draft.organizerID, draft.eventID,
         `🎉 你的活動「${draft.title}」修改版本已審核通過！`]
      );

    } else {
      // 審核不通過：恢復 Events 的 auditStatus，草稿標記為 rejected
      await connection.query(
        `UPDATE Events 
         SET auditStatus = 'rejected', reaudit_count = reaudit_count + 1, rejectReason = ?
         WHERE eventID = ?`,
        [rejectReason || null, draft.eventID]
      );

      // 通知主辦方
      await connection.query(
        `INSERT INTO Notifications (userID, eventID, message) VALUES (?, ?, ?)`,
        [draft.organizerID, draft.eventID,
         `❗️ 你的活動「${draft.title}」修改版本審核未通過，原因：${rejectReason}`]
      );
    }

    // 更新草稿狀態
    await connection.query(
      `UPDATE EventDrafts SET auditStatus = ?, rejectReason = ? WHERE draftID = ?`,
      [result, rejectReason || null, draftID]
    );

    if (result === 'approved') {
      await connection.query(
        'DELETE FROM Draft_Tag WHERE draftID = ?',
        [draftID]
      );
    }

    // 寫入 Audit_Log
    await connection.query(
      `INSERT INTO Audit_Log
        (eventID, adminID, result, audit_reason, comment, ordinal_num, rejectReason, audit_type)
       VALUES (?, ?, ?, 'general', ?,
        (SELECT COUNT(*) + 1 FROM Audit_Log al WHERE al.eventID = ?), ?, 'edit')`,
      [draft.eventID, adminID, result, comment || null, draft.eventID, rejectReason || null]
    );

    await connection.commit();
    res.json({ message: '審核完成' });

  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤，操作已復原' });
  } finally {
    connection.release();
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
  const { isVerified, version } = req.body;
  const adminID = req.user.userID;

  try {
    // 檢查 version
    const [reportRows] = await db.query(
      'SELECT version FROM Reports WHERE reportID = ?',
      [reportID]
    );

    if (reportRows.length === 0) {
      return res.status(404).json({ message: '檢舉不存在' });
    }

    if (reportRows[0].version !== version) {
      return res.status(409).json({
        message: '此檢舉已被其他管理員審核，請重新整理後再試'
      });
    }

    const [updateResult] = await db.query(
      'UPDATE Reports SET isVerified = ?, adminID = ?, version = version + 1 WHERE reportID = ?',
      [isVerified ? 1 : 0, adminID, reportID, version]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(409).json({
        message: '此檢舉已被其他管理員審核，請重新整理後再試'
      });
    }

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
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

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

    // 檢查是否已經被核實過
    const [eventCheck] = await db.query(
      'SELECT isReported, organizerID, title FROM Events WHERE eventID = ?', [eventID]
    );
    if (eventCheck[0].isReported === 1) {
      return res.status(409).json({ message: '此活動已被核實，請重新整理' });
    }
    const { organizerID, title } = eventCheck[0];

    // 標記活動為被檢舉成功（不顯示給使用者）
    await connection.query(
      `UPDATE Events SET isReported = 1, status = 'cancelled' WHERE eventID = ?`,
      [eventID]
    );

    // 封鎖主辦人發活動權限 1 年
    const banUntil = new Date();
    banUntil.setFullYear(banUntil.getFullYear() + 1);
    await connection.query(
      'UPDATE Users SET isBanned = 1, banUntil = ? WHERE userID = ?',
      [banUntil, organizerID]
    );

    // 通知主辦人
    await db.query(
      `INSERT INTO Notifications (userID, eventID, message) VALUES (?, ?, ?)`,
      [organizerID, eventID,
       `⚠️ 你的活動「${title}」因檢舉屬實已被下架，發布活動權限暫停 1 年`]
    );

    await connection.commit();
    res.json({ message: '檢舉核實成功，活動已下架，主辦人已被封鎖' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤，操作已復原' });
  } finally {
    connection.release();
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