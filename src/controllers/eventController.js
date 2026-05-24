const db = require('../lib/mysql');

// 分類對應 rank 欄位
const categoryRankMap = {
  career: 'career_rank',
  arts: 'arts_rank',
  social: 'social_rank',
  volunteer: 'volunteer_rank',
};

// 【取得主頁活動列表（含權重排序）】
exports.getEvents = async (req, res) => {
  const userID = req.query.userID; // 前端帶上 userID 來取得個人化排序
  const sortBy = req.query.sortBy; // 'latest' | 'registering' | 'mostFavorited'
  const category = req.query.category;

  try {
    let prefs = null;
    if (userID) {
      const [rows] = await db.query(
        'SELECT * FROM UserPreferences WHERE userID = ?', [userID]
      );
      if (rows.length > 0) prefs = rows[0];
    }

    // 動態建立 CASE WHEN 語法算分類權重
    let categoryWeightSQL = `CASE e.category
      WHEN 'career'   THEN ${prefs ? (6 - prefs.career_rank) : 2}
      WHEN 'arts'     THEN ${prefs ? (6 - prefs.arts_rank) : 2}
      WHEN 'social'   THEN ${prefs ? (6 - prefs.social_rank) : 2}
      WHEN 'volunteer'THEN ${prefs ? (6 - prefs.volunteer_rank) : 2}
    END`;
    // 排名1→權重5, 排名2→4, 排名3→3, 排名4→2：用 (6 - rank) 換算

    let registrationWeight = `CASE WHEN (e.registrationDeadline IS NULL OR e.registrationDeadline > NOW()) THEN 1 ELSE 0 END`;

    // 新增：活動是否已結束
    let notEndedWeight = `CASE WHEN (e.eventEndTime IS NULL AND e.eventTime > NOW()) OR (e.eventEndTime IS NOT NULL AND e.eventEndTime > NOW()) THEN 1 ELSE 0 END`;

    let orderSQL = '';
    if (sortBy === 'latest') {
      // 最新發布：直接用發布時間排序
      orderSQL = `e.publishedAt DESC`;
    } else if (sortBy === 'registering') {
      // 報名中：報名未截止的排前面，同樣狀態再按發布時間
      orderSQL = `(${registrationWeight}) DESC, e.publishedAt DESC`;
    } else if (sortBy === 'mostFavorited') {
      // 收藏最多：收藏數排前面
      orderSQL = `favoriteCount DESC, e.publishedAt DESC`;
    } else {
      // 預設：分類權重 + 報名未過期 + 發布時間近
      orderSQL = `(${notEndedWeight}) * 20 + (${categoryWeightSQL}) * 0.5 + (${registrationWeight}) * 10 DESC, e.publishedAt DESC`;
  }

    let whereSQL = `e.status = 'approved' AND e.auditStatus = 'approved'`;
    const params = [];

    if (category) {
      const categories = category.split(',');
      const placeholders = categories.map(() => '?').join(',');
      whereSQL += ` AND e.category IN (${placeholders})`;
      params.push(...categories);
    }

    const [events] = await db.query(`
      SELECT e.*,
        COUNT(DISTINCT f.favoriteID) AS favoriteCount,
        AVG(r.stars) AS avgStars,
        GROUP_CONCAT(DISTINCT h.hashtag) AS hashtagList
      FROM Events e
      LEFT JOIN Favorites f ON e.eventID = f.eventID
      LEFT JOIN Reviews r ON e.eventID = r.eventID
      LEFT JOIN Event_Tag et ON e.eventID = et.eventID
      LEFT JOIN Hashtags h ON et.hashtagID = h.hashtagID
      WHERE ${whereSQL}
      GROUP BY e.eventID
      ORDER BY ${orderSQL}
    `, params);

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【搜尋活動】
exports.searchEvents = async (req, res) => {
  const { keyword, category, date, location, fee, hasMeal, hasGift } = req.query;

  try {
    let conditions = ["e.status = 'approved'", "e.auditStatus = 'approved'"];
    let params = [];

    if (keyword) {
      conditions.push('(e.title LIKE ? OR e.description LIKE ? OR h.hashtag LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (category) {
      const categories = category.split(',');
      const placeholders = categories.map(() => '?').join(',');
      conditions.push(`e.category IN (${placeholders})`);
      params.push(...categories);
    }
    //if (category) { conditions.push('e.category = ?'); params.push(category); }
    if (date) { conditions.push('DATE(e.eventTime) = ?'); params.push(date); }
    if (location) { conditions.push('e.location LIKE ?'); params.push(`%${location}%`); }
    if (fee !== undefined) { conditions.push('e.fee <= ?'); params.push(fee); }
    if (hasMeal === 'true') { conditions.push('e.hasMeal = 1'); }
    if (hasGift === 'true') { conditions.push('e.hasGift = 1'); }

    const whereSQL = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [events] = await db.query(`
      SELECT e.*, COUNT(DISTINCT f.favoriteID) AS favoriteCount,
             GROUP_CONCAT(DISTINCT h.hashtag) AS hashtagList
      FROM Events e
      LEFT JOIN Favorites f ON e.eventID = f.eventID
      LEFT JOIN Event_Tag et ON e.eventID = et.eventID
      LEFT JOIN Hashtags h ON et.hashtagID = h.hashtagID
      ${whereSQL}
      GROUP BY e.eventID
      ORDER BY e.publishedAt DESC
    `, params);

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【新增活動】
exports.createEvent = async (req, res) => {
  const {
    title, category, description, eventTime, eventEndTime, location,
    registrationDeadline, registrationLink, hashtags, imageURL,
    hasMeal, hasGift, fee
  } = req.body;
  const organizerID = req.user.userID;

  // 檢查是否被封鎖發活動
  try {
    const [userRows] = await db.query('SELECT isBanned, banUntil FROM Users WHERE userID = ?', [organizerID]);
    const user = userRows[0];
    if (user.isBanned && (!user.banUntil || new Date(user.banUntil) > new Date())) {
      return res.status(403).json({ message: '你的發布活動權限已被停用' });
    }

    // deleteAt = 發布時間 + 5 年
    const deleteAt = new Date();
    deleteAt.setFullYear(deleteAt.getFullYear() + 5);

    const [result] = await db.query(
      `INSERT INTO Events
        (organizerID, title, category, description, eventTime, eventEndTime, location,
         registrationDeadline, registrationLink, imageURL,
         hasMeal, hasGift, fee, deleteAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizerID, title, category, description, eventTime, eventEndTime || null, location,
       registrationDeadline || null, registrationLink || null,
       imageURL || null, hasMeal ? 1 : 0, hasGift ? 1 : 0, fee || 0, deleteAt]
    );

    const eventID = result.insertId;

    // 插入 hashtags
    if (hashtags && hashtags.length > 0) {
      for (const tag of hashtags) {
        if (!tag.trim()) continue;

        // 如果 hashtag 不存在就新增，存在就取得 ID
        await db.query(
          'INSERT IGNORE INTO Hashtags (hashtag) VALUES (?)',
          [tag.trim()]
        );
        const [hashtagRows] = await db.query(
          'SELECT hashtagID FROM Hashtags WHERE hashtag = ?',
          [tag.trim()]
        );
        const hashtagID = hashtagRows[0].hashtagID;

        // 建立關聯
        await db.query(
          'INSERT IGNORE INTO Event_Tag (eventID, hashtagID) VALUES (?, ?)',
          [eventID, hashtagID]
        );
      }
    }

    res.status(201).json({ message: '活動已送出審核' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取消活動】
exports.cancelEvent = async (req, res) => {
  const { eventID } = req.params;
  const userID = req.user.userID;

  try {
    const [rows] = await db.query(
      'SELECT organizerID FROM Events WHERE eventID = ?', [eventID]
    );
    if (rows.length === 0) return res.status(404).json({ message: '活動不存在' });
    if (rows[0].organizerID !== userID) return res.status(403).json({ message: '無權操作' });

    await db.query("UPDATE Events SET status = 'cancelled' WHERE eventID = ?", [eventID]);
    res.json({ message: '活動已取消' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【新增評價】
exports.addReview = async (req, res) => {
  const { eventID } = req.params;
  const { hasAttended, stars, content } = req.body;
  const userID = req.user.userID;

  try {
    await db.query(
      'INSERT INTO Reviews (userID, eventID, hasAttended, stars, content) VALUES (?, ?, ?, ?, ?)',
      [userID, eventID, hasAttended ? 1 : 0, hasAttended ? stars : null, content || null]
    );
    res.status(201).json({ message: '評價送出成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【瀏覽紀錄】
exports.recordHistory = async (req, res) => {
  const { eventID } = req.params;
  const userID = req.user.userID;

  try {
    // 避免重複，先刪舊的再新增
    await db.query(
      'DELETE FROM BrowsingHistory WHERE userID = ? AND eventID = ?', [userID, eventID]
    );
    await db.query(
      'INSERT INTO BrowsingHistory (userID, eventID) VALUES (?, ?)', [userID, eventID]
    );
    res.json({ message: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取得單一活動詳情】
exports.getEventDetail = async (req, res) => {
  const { eventID } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM Events WHERE eventID = ?', [eventID]);
    if (rows.length === 0) return res.status(404).json({ message: '找不到此活動' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【取得活動詳細（含評價）】
exports.getEventDetail = async (req, res) => {
  const { eventID } = req.params;

  try {
    // 取得活動資訊
    const [eventRows] = await db.query(
      `SELECT e.*, u.username AS organizerName
       FROM Events e
       JOIN Users u ON e.organizerID = u.userID
       WHERE e.eventID = ?`,
      [eventID]
    );

    if (eventRows.length === 0) return res.status(404).json({ message: '活動不存在' });

    const event = eventRows[0];

    // 取得 hashtags（透過關聯表）
    const [hashtags] = await db.query(
      `SELECT h.hashtag
       FROM Event_Tag et
       JOIN Hashtags h
       ON et.hashtagID = h.hashtagID
       WHERE et.eventID = ?`,
      [eventID]
    );
    event.hashtags = hashtags.map(h => h.hashtag);

    // 取得評價
    const [reviews] = await db.query(
      `SELECT r.*, u.username
       FROM Reviews r
       JOIN Users u ON r.userID = u.userID
       WHERE r.eventID = ?
       ORDER BY r.createdAt DESC`,
      [eventID]
    );
    event.reviews = reviews;

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

// 【修改活動】
exports.updateEvent = async (req, res) => {
  const { eventID } = req.params;
  const userID = req.user.userID;
  const {
    title, category, description, eventTime, eventEndTime, location,
    registrationDeadline, registrationLink, hashtags,
    imageURL, hasMeal, hasGift, fee
  } = req.body;

  try {
    // 確認是本人的活動
    const [rows] = await db.query(
      'SELECT organizerID FROM Events WHERE eventID = ?', [eventID]
    );
    if (rows.length === 0) return res.status(404).json({ message: '活動不存在' });
    if (rows[0].organizerID !== userID) return res.status(403).json({ message: '無權修改此活動' });

    await db.query(
      `UPDATE Events SET
        title = ?, category = ?, description = ?,
        eventTime = ?, eventEndTime = ?, location = ?,
        registrationDeadline = ?, registrationLink = ?,
        imageURL = ?, hasMeal = ?, hasGift = ?, fee = ?,
        auditStatus = 'unapproved'
       WHERE eventID = ?`,
      [title, category, description, eventTime, eventEndTime || null, location,
        registrationDeadline || null, registrationLink || null,
        imageURL || null, hasMeal ? 1 : 0, hasGift ? 1 : 0, fee || 0,
        eventID]
    );

    // 先刪除舊的 hashtags 再重新插入
    await db.query('DELETE FROM Event_Tag WHERE eventID = ?', [eventID]);
    // 重新插入新的
    if (hashtags && hashtags.length > 0) {
      for (const tag of hashtags) {
        if (!tag.trim()) continue;

        await db.query(
          'INSERT IGNORE INTO Hashtags (hashtag) VALUES (?)',
          [tag.trim()]
        );
        const [hashtagRows] = await db.query(
          'SELECT hashtagID FROM Hashtags WHERE hashtag = ?',
          [tag.trim()]
        );
        const hashtagID = hashtagRows[0].hashtagID;

        await db.query(
          'INSERT IGNORE INTO Event_Tag (eventID, hashtagID) VALUES (?, ?)',
          [eventID, hashtagID]
        );
      }
    }

    res.json({ message: '活動已更新，重新送出審核' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
};