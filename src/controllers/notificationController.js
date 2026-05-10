const db = require('../lib/mysql');

// 取得通知列表
exports.getNotifications = async (req, res) => {
  const userID = req.user.userID;
  try {
    const [notifications] = await db.query(
      `SELECT n.*, e.title AS eventTitle
       FROM Notifications n
       JOIN Events e ON n.eventID = e.eventID
       WHERE n.userID = ?
       ORDER BY n.createdAt DESC
       LIMIT 50`,
      [userID]
    );
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 標記單一已讀
exports.markAsRead = async (req, res) => {
  const { notificationID } = req.params;
  const userID = req.user.userID;
  try {
    await db.query(
      'UPDATE Notifications SET isRead = 1 WHERE notificationID = ? AND userID = ?',
      [notificationID, userID]
    );
    res.json({ message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 全部標記已讀
exports.markAllAsRead = async (req, res) => {
  const userID = req.user.userID;
  try {
    await db.query(
      'UPDATE Notifications SET isRead = 1 WHERE userID = ?',
      [userID]
    );
    res.json({ message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};