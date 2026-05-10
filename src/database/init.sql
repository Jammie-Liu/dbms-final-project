CREATE DATABASE IF NOT EXISTS dbms_project;
USE dbms_project;

-- 使用者
CREATE TABLE Users (
  userID INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,  -- 存 bcrypt hash
  role ENUM('user', 'admin') DEFAULT 'user',
  isBanned TINYINT(1) DEFAULT 0,   -- 被封鎖發活動的權限
  banUntil DATETIME NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 使用者活動偏好（四大分類排名）
CREATE TABLE UserPreferences (
  preferenceID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  career_rank TINYINT NOT NULL,       -- 職涯與學術成長 (1~4)
  arts_rank TINYINT NOT NULL,         -- 藝文與生活體驗
  social_rank TINYINT NOT NULL,       -- 社團與社交娛樂
  volunteer_rank TINYINT NOT NULL,    -- 志願服務與社會參與
  FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 活動
CREATE TABLE Events (
  eventID INT AUTO_INCREMENT PRIMARY KEY,
  organizerID INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  category ENUM('career','arts','social','volunteer') NOT NULL,
  description TEXT,
  eventTime DATETIME NOT NULL,
  location VARCHAR(255) NOT NULL,
  registrationDeadline DATETIME NULL,
  registrationLink VARCHAR(500) NULL,
  hashtag VARCHAR(255) NULL,
  imageURL VARCHAR(500) NULL,
  hasMeal TINYINT(1) DEFAULT 0,
  hasGift TINYINT(1) DEFAULT 0,
  fee INT DEFAULT 0,
  status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
  auditStatus ENUM('unapproved','approved','rejected') DEFAULT 'unapproved',
  publishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleteAt DATETIME,   -- 發布時間 + 5年，自動計算
  FOREIGN KEY (organizerID) REFERENCES Users(userID)
);

-- 收藏
CREATE TABLE Favorites (
  favoriteID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  folderID INT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

-- 收藏資料夾
CREATE TABLE FavoriteFolders (
  folderID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  folderName VARCHAR(100) NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 瀏覽紀錄
CREATE TABLE BrowsingHistory (
  historyID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  viewedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

-- 評價
CREATE TABLE Reviews (
  reviewID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  hasAttended TINYINT(1) NOT NULL,
  stars TINYINT NULL,          -- 1~5，沒參加過不能評分
  content TEXT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

-- 檢舉
CREATE TABLE Reports (
  reportID INT AUTO_INCREMENT PRIMARY KEY,
  reporterID INT NOT NULL,
  eventID INT NOT NULL,
  reason ENUM('inappropriate','violence','fraud','misinformation') NOT NULL,
  isVerified TINYINT(1) NULL,   -- 管理員審核結果 (1=屬實, 0=不屬實)
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporterID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

-- 忘記密碼 token
CREATE TABLE PasswordResetTokens (
  tokenID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expiresAt DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 通知
CREATE TABLE Notifications (
  notificationID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  isRead TINYINT(1) DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

-- 預設管理員帳號（密碼先用明文，之後要換成 bcrypt hash）
INSERT INTO Users (username, email, password, role)
VALUES ('admin', 'dbmsgroup0@gmail.com', '@dbmsGroup8!', 'admin');