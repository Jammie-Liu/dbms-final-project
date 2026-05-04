const jwt = require('jsonwebtoken');

// 登入後產生 token
function generateToken(user) {
  return jwt.sign(
    { userID: user.userID, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 這是 middleware：放在 route 中間，驗證使用者有沒有登入
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: '請先登入' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // 把解碼後的資訊塞進 req，之後 controller 可以用
    next();              // 繼續往下走到 controller
  } catch (err) {
    return res.status(403).json({ message: 'Token 無效' });
  }
}

module.exports = { generateToken, verifyToken };