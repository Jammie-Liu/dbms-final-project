const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306, 
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+08:00',
});

// 每個連線建立時設定時區
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+08:00'");
});

const promisePool = pool.promise();

// 支援 getConnection（用於 Transaction）
promisePool.getConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) return reject(err);
      const promiseConnection = connection.promise();
      promiseConnection.release = () => connection.release();
      resolve(promiseConnection);
    });
  });ㄎ
};

module.exports = promisePool;