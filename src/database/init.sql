-- 使用者
CREATE TABLE IF NOT EXISTS Users (
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
CREATE TABLE IF NOT EXISTS UserPreferences (
  preferenceID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  career_rank TINYINT NOT NULL,       -- 職涯與學術成長 (1~4)
  arts_rank TINYINT NOT NULL,         -- 藝文與生活體驗
  social_rank TINYINT NOT NULL,       -- 社團與社交娛樂
  volunteer_rank TINYINT NOT NULL,    -- 志願服務與社會參與
  FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 活動
CREATE TABLE IF NOT EXISTS Events (
  eventID INT AUTO_INCREMENT PRIMARY KEY,
  organizerID INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  category ENUM('career','arts','social','volunteer') NOT NULL,
  description TEXT,
  eventTime DATETIME NOT NULL,
  location VARCHAR(255) NOT NULL,
  registrationDeadline DATETIME NULL,
  registrationLink VARCHAR(500) NULL,
  imageURL VARCHAR(500) NULL,
  hasMeal TINYINT(1) DEFAULT 0,
  hasGift TINYINT(1) DEFAULT 0,
  fee INT DEFAULT 0,
  status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
  auditStatus ENUM('unapproved','approved','rejected','draft_pending') DEFAULT 'unapproved',
  publishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleteAt DATETIME,   -- 發布時間 + 5年，自動計算
  rejectReason TEXT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  eventEndTime DATETIME NULL,
  reaudit_count INT DEFAULT 0,
  isReported TINYINT(1) DEFAULT 0,
  version INT DEFAULT 0,  -- 用於樂觀鎖，更新時需帶上當前版本號，成功後版本號自動加1
  edit_count INT DEFAULT 0,
  FOREIGN KEY (organizerID) REFERENCES Users(userID)
);

-- 收藏
CREATE TABLE IF NOT EXISTS Favorites (
  favoriteID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  folderID INT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_favorite (userID, eventID), -- 同一使用者不能重複收藏同一活動
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID),
  FOREIGN KEY (folderID) REFERENCES FavoriteFolders(folderID)
);

-- 收藏資料夾
CREATE TABLE IF NOT EXISTS FavoriteFolders (
  folderID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  folderName VARCHAR(100) NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 瀏覽紀錄
CREATE TABLE IF NOT EXISTS BrowsingHistory (
  historyID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  viewedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

-- 評價
CREATE TABLE IF NOT EXISTS Reviews (
  reviewID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  hasAttended TINYINT(1) NOT NULL,
  stars TINYINT NULL,          -- 1~5，沒參加過不能評分
  content TEXT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  isEdited TINYINT(1) DEFAULT 0,
  updatedAt DATETIME NULL,
  UNIQUE KEY unique_review (userID, eventID), -- 同一使用者只能評價同一活動一次
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

-- 檢舉
CREATE TABLE IF NOT EXISTS Reports (
  reportID INT AUTO_INCREMENT PRIMARY KEY,
  reporterID INT NOT NULL,
  eventID INT NOT NULL,
  reason ENUM('inappropriate','violence','fraud','misinformation','other') NOT NULL,
  isVerified TINYINT(1) NULL,   -- 管理員審核結果 (1=屬實, 0=不屬實)
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  detail TEXT NULL,             -- 其他檢舉原因的詳細說明
  adminID INT NULL,            -- 審核的管理員ID
  version INT DEFAULT 0,        -- 用於樂觀鎖，更新時需帶上當前版本號，成功後版本號自動加1
  FOREIGN KEY (reporterID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID),
  FOREIGN KEY (adminID) REFERENCES Users(userID)
);

-- 忘記密碼 token
CREATE TABLE IF NOT EXISTS PasswordResetTokens (
  tokenID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expiresAt DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 通知
CREATE TABLE IF NOT EXISTS Notifications (
  notificationID INT AUTO_INCREMENT PRIMARY KEY,
  userID INT NOT NULL,
  eventID INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  isRead TINYINT(1) DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userID) REFERENCES Users(userID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID)
);

CREATE TABLE IF NOT EXISTS Hashtags (
  hashtagID INT AUTO_INCREMENT PRIMARY KEY,
  hashtag VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Event_Tag (
  eventID INT NOT NULL,
  hashtagID INT NOT NULL,
  PRIMARY KEY (eventID, hashtagID),
  FOREIGN KEY (eventID) REFERENCES Events(eventID),
  FOREIGN KEY (hashtagID) REFERENCES Hashtags(hashtagID)
);

CREATE TABLE IF NOT EXISTS Audit_Log (
  audit_id INT AUTO_INCREMENT PRIMARY KEY,
  eventID INT NOT NULL,
  adminID INT NOT NULL,
  result ENUM('approved', 'rejected') NOT NULL,
  audit_reason ENUM('general', 'reported') NOT NULL,  -- 退件原因
  comment TEXT NULL,               -- 管理員備註
  ordinal_num INT NOT NULL,        -- 第幾次審核
  audit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  rejectReason TEXT NULL,
  audit_type ENUM('reaudit', 'edit') DEFAULT 'reaudit', -- 審核類型：重新審核或編輯後審核
  FOREIGN KEY (eventID) REFERENCES Events(eventID),
  FOREIGN KEY (adminID) REFERENCES Users(userID)
);

CREATE TABLE IF NOT EXISTS EventDrafts (
  draftID INT AUTO_INCREMENT PRIMARY KEY,
  eventID INT NOT NULL,
  organizerID INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  category ENUM('career','arts','social','volunteer') NOT NULL,
  description TEXT,
  eventTime DATETIME NOT NULL,
  eventEndTime DATETIME NULL,
  location VARCHAR(255) NOT NULL,
  registrationDeadline DATETIME NULL,
  registrationLink VARCHAR(500) NULL,
  imageURL VARCHAR(500) NULL,
  hasMeal TINYINT(1) DEFAULT 0,
  hasGift TINYINT(1) DEFAULT 0,
  fee INT DEFAULT 0,
  auditStatus ENUM('unapproved','approved','rejected') DEFAULT 'unapproved',
  rejectReason TEXT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (eventID) REFERENCES Events(eventID),
  FOREIGN KEY (organizerID) REFERENCES Users(userID)
);

CREATE TABLE IF NOT EXISTS Draft_Tag (
  draftID INT NOT NULL,
  hashtagID INT NOT NULL,
  PRIMARY KEY (draftID, hashtagID),
  FOREIGN KEY (draftID) REFERENCES EventDrafts(draftID) ON DELETE CASCADE,
  FOREIGN KEY (hashtagID) REFERENCES Hashtags(hashtagID) ON DELETE CASCADE
);