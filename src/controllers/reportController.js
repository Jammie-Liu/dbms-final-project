const db = require('../lib/mysql');

exports.reportEvent = async (req, res) => {
  const { eventID } = req.params;
  const { reason, detail } = req.body;
  const reporterID = req.user.userID;

  try {
    // 新增檢舉
    await db.query(
      'INSERT INTO Reports (reporterID, eventID, reason, detail) VALUES (?, ?, ?, ?)',
      [reporterID, eventID, reason, detail || null]
    );

    res.status(201).json({ message: '檢舉已送出' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};