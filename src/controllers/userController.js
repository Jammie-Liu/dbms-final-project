const db = require('../lib/mysql');
const bcrypt = require('bcrypt');
const { generateToken } = require('../lib/auth');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

function isValidPassword(pw) {
  if (pw.length < 8 || pw.length > 12) return false;
  if (!/[0-9]/.test(pw)) return false;
  if (!/[a-zA-Z]/.test(pw)) return false;
  return true;
}

// 【註冊】
exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!isValidPassword(password)) {
    return res.status(400).json({ message: '密碼需 8~12 字元，且含至少 1 數字與 1 英文' });
  }
  try {
    const [existing] = await db.query('SELECT userID FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email 已被使用' });
    }
    const hashedPw = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPw]
    );
    res.status(201).json({ message: '註冊成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【登入】
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email 或密碼錯誤' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Email 或密碼錯誤' });
    }
    const token = generateToken(user);
    const [prefs] = await db.query(
      'SELECT * FROM UserPreferences WHERE userID = ?', [user.userID]
    );
    res.json({
      token,
      userID: user.userID,
      username: user.username,
      role: user.role,
      hasPreferences: prefs.length > 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【設定活動偏好】
exports.setPreferences = async (req, res) => {
  const { career_rank, arts_rank, social_rank, volunteer_rank } = req.body;
  const userID = req.user.userID;
  const ranks = [career_rank, arts_rank, social_rank, volunteer_rank];
  if (new Set(ranks).size !== 4 || ranks.some(r => r < 1 || r > 4)) {
    return res.status(400).json({ message: '排名需為 1~4 且不重複' });
  }
  try {
    await db.query(
      `INSERT INTO UserPreferences (userID, career_rank, arts_rank, social_rank, volunteer_rank)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         career_rank=VALUES(career_rank), arts_rank=VALUES(arts_rank),
         social_rank=VALUES(social_rank), volunteer_rank=VALUES(volunteer_rank)`,
      [userID, career_rank, arts_rank, social_rank, volunteer_rank]
    );
    res.json({ message: '偏好設定成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取得偏好設定】
exports.getPreferences = async (req, res) => {
  const userID = req.user.userID;
  try {
    const [rows] = await db.query(
      'SELECT * FROM UserPreferences WHERE userID = ?', [userID]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: '尚未設定偏好' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【忘記密碼】
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.json({ message: '若此 Email 存在，重設連結已寄出' });
    }
    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await db.query(
      'INSERT INTO PasswordResetTokens (userID, token, expiresAt) VALUES (?, ?, ?)',
      [user.userID, token, expiresAt]
    );
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: '重設密碼',
      html: `<p>點此連結重設密碼（30分鐘內有效）：</p>
             <a href="http://localhost:3000/reset-password.html?token=${token}">重設密碼</a>`,
    });
    res.json({ message: '若此 Email 存在，重設連結已寄出' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【重設密碼】
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ message: '密碼格式不符' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM PasswordResetTokens WHERE token = ? AND used = 0 AND expiresAt > NOW()',
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Token 無效或已過期' });
    }
    const { userID, tokenID } = rows[0];
    const hashedPw = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE Users SET password = ? WHERE userID = ?', [hashedPw, userID]);
    await db.query('UPDATE PasswordResetTokens SET used = 1 WHERE tokenID = ?', [tokenID]);
    res.json({ message: '密碼重設成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取得我的活動】
exports.getMyEvents = async (req, res) => {
  const userID = req.user.userID;
  try {
    const [events] = await db.query(
      'SELECT * FROM Events WHERE organizerID = ? ORDER BY publishedAt DESC',
      [userID]
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取得收藏列表】
exports.getFavorites = async (req, res) => {
  const userID = req.user.userID;
  const { folderID } = req.query;
  try {
    let sql = `
      SELECT e.*, f.folderID, f.createdAt as favoritedAt
      FROM Favorites f
      JOIN Events e ON f.eventID = e.eventID
      WHERE f.userID = ?
    `;
    const params = [userID];
    if (folderID) {
      sql += ' AND f.folderID = ?';
      params.push(folderID);
    }
    sql += ' ORDER BY f.createdAt DESC';
    const [events] = await db.query(sql, params);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【新增收藏】
exports.addFavorite = async (req, res) => {
  const userID = req.user.userID;
  const { eventID } = req.params;
  const folderID = req.body?.folderID || null;
  try {
    const [existing] = await db.query(
      'SELECT favoriteID FROM Favorites WHERE userID = ? AND eventID = ?',
      [userID, eventID]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: '已經收藏過了' });
    }
    await db.query(
      'INSERT INTO Favorites (userID, eventID, folderID) VALUES (?, ?, ?)',
      [userID, eventID, folderID || null]
    );
    res.status(201).json({ message: '收藏成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取消收藏】
exports.removeFavorite = async (req, res) => {
  const userID = req.user.userID;
  const { eventID } = req.params;
  try {
    await db.query(
      'DELETE FROM Favorites WHERE userID = ? AND eventID = ?',
      [userID, eventID]
    );
    res.json({ message: '已取消收藏' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取得收藏資料夾】
exports.getFolders = async (req, res) => {
  const userID = req.user.userID;
  try {
    const [folders] = await db.query(
      'SELECT * FROM FavoriteFolders WHERE userID = ? ORDER BY createdAt DESC',
      [userID]
    );
    res.json(folders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【建立收藏資料夾】
exports.createFolder = async (req, res) => {
  const userID = req.user.userID;
  const { folderName } = req.body;
  if (!folderName) {
    return res.status(400).json({ message: '請輸入資料夾名稱' });
  }
  try {
    await db.query(
      'INSERT INTO FavoriteFolders (userID, folderName) VALUES (?, ?)',
      [userID, folderName]
    );
    res.status(201).json({ message: '資料夾建立成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取得瀏覽紀錄】
exports.getHistory = async (req, res) => {
  const userID = req.user.userID;
  try {
    const [events] = await db.query(
      `SELECT e.*, h.viewedAt
       FROM BrowsingHistory h
       JOIN Events e ON h.eventID = e.eventID
       WHERE h.userID = ?
       ORDER BY h.viewedAt DESC
       LIMIT 50`,
      [userID]
    );
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};