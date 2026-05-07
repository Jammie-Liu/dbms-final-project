const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware（每個 request 進來都會先跑這裡）
app.use(cors());
app.use(express.json());                // 讓 express 能讀懂 JSON body
app.use(express.static('public'));        // 讓前端靜態檔案能被訪問

// 掛載 Routes
const userRoutes = require('./src/routes/userRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const reportRoutes = require('./src/routes/reportRoutes');

app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);


// 讓首頁明確指向 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`伺服器跑在 http://localhost:${PORT}`);
});