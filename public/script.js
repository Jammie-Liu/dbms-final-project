// 檢查是否登入
const token = localStorage.getItem('token');
const userID = localStorage.getItem('userID');
const username = localStorage.getItem('username');

if (!token) {
    window.location.href = 'login.html';
}

document.getElementById('welcomeText').textContent = `Hi, ${username}`;

let currentSort = 'default';
let currentCategory = '';

// 載入活動
let favoritedEventIDs = new Set(); // 全域變數存收藏的 eventID

async function loadEvents(sortBy = 'default', keyword = '', category = '') {
  const eventList = document.getElementById('eventList');
  eventList.innerHTML = '<p class="no-events"><span class="no-events-icon">⏳</span>載入中...</p>';

  try {
    // 同時抓活動列表和收藏清單
    const [eventsRes, favRes] = await Promise.all([
      fetch(`/api/events?userID=${userID}&sortBy=${sortBy}${keyword ? '&keyword=' + encodeURIComponent(keyword) : ''}${category ? '&category=' + category : ''}`),
      fetch('/api/users/favorites', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    const events = await eventsRes.json();
    const favData = await favRes.json();

    // 把收藏的 eventID 存進 Set
    favoritedEventIDs = new Set(favData.map(f => f.eventID));

    if (events.length === 0) {
      eventList.innerHTML = '<p class="no-events"><span class="no-events-icon">🔍</span>目前沒有活動</p>';
      return;
    }

    eventList.innerHTML = events.map((event, i) => renderEventCard(event, i)).join('');
  } catch (err) {
    eventList.innerHTML = '<p class="no-events">載入失敗，請重試</p>';
    console.error(err);
  }
}

// 活動卡片 HTML
function renderEventCard(event, index) {
  const statusLabel = getStatusLabel(event);
  const categoryLabel = getCategoryLabel(event.category);
  const eventTime = new Date(event.eventTime).toLocaleDateString('zh-TW');
  const stars = event.avgStars ? `⭐ ${parseFloat(event.avgStars).toFixed(1)}` : '';

  // 判斷是否已收藏
  const isFav = favoritedEventIDs.has(event.eventID);

  return `
    <div class="event-card animate-fade-up"
      style="animation-delay: ${index * 0.05}s"
      onclick="goToEvent(${event.eventID})">
      <div class="card-top">
        <span class="status-tag ${statusLabel.class}">${statusLabel.text}</span>
        <div class="card-actions">
          <span onclick="toggleFavorite(${event.eventID}, this, event)"
            class="heart-btn"
            data-fav="${isFav}"
            style="color: ${isFav ? '#ef4444' : ''}">
            ${isFav ? '❤️' : '🤍'}
          </span>
          <span onclick="event.stopPropagation(); showReportMenu(${event.eventID})"
            class="more-btn">⋯</span>
        </div>
      </div>

      ${event.imageURL
        ? `<img src="${event.imageURL}" class="card-img" alt="活動圖片">`
        : `<div class="card-img-placeholder">${categoryLabel.emoji}</div>`
      }

      <div class="card-body">
        <span class="category-tag">${categoryLabel.emoji} ${categoryLabel.text}</span>
        <h3>${event.title}</h3>
        <div class="card-meta">
          <p>📅 ${eventTime}</p>
          <p>📍 ${event.location}</p>
          <p>💰 ${event.fee > 0 ? event.fee + ' 元' : '免費'}</p>
        </div>
        <div class="card-footer">
          <span>❤️ ${event.favoriteCount || 0}</span>
          <span>${stars}</span>
        </div>
      </div>
    </div>
  `;
}

// 活動狀態標籤
function getStatusLabel(event) {
    if (event.status === 'cancelled') return { text: '已取消', class: 'cancelled' };
    const now = new Date();
    const eventTime = new Date(event.eventTime);
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

    if (eventTime < now) return { text: '已結束', class: 'ended' };
    if (deadline && deadline < now) return { text: '報名截止', class: 'closed' };
    if (eventTime - now < 1000 * 60 * 60 * 24 * 3) return { text: '即將開始', class: 'soon' };
    return { text: '報名中', class: 'open' };
}

// 分類標籤
function getCategoryLabel(category) {
    const map = {
        career: { text: '職涯與學術成長', emoji: '🎓' },
        arts: { text: '藝文與生活體驗', emoji: '🎨' },
        social: { text: '社團與社交娛樂', emoji: '🎉' },
        volunteer: { text: '志願服務與社會參與', emoji: '🤝' },
    };
    return map[category] || { text: category, emoji: '📌' };
}

// 點進活動詳細頁 + 記錄瀏覽紀錄
async function goToEvent(eventID) {
    try {
        await fetch(`/api/events/${eventID}/history`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (err) { }
    window.location.href = `event.html?id=${eventID}`;
}

// 收藏
async function toggleFavorite(eventID, el, e) {
  e.stopPropagation();

  const isFav = el.dataset.fav === 'true';
  const method = isFav ? 'DELETE' : 'POST';

  try {
    const res = await fetch(`/api/users/favorites/${eventID}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      // 更新全域 Set
      if (isFav) {
        favoritedEventIDs.delete(eventID);
      } else {
        favoritedEventIDs.add(eventID);
      }

      // 更新畫面
      el.dataset.fav = String(!isFav);
      el.textContent = isFav ? '🤍' : '❤️';
      el.style.color = isFav ? '' : '#ef4444';
    } else {
      const text = await res.text();
      console.error('error:', text);
    }
  } catch (err) {
    console.error(err);
  }
}

// 檢舉
function showReportMenu(eventID) {
    const reasons = ['inappropriate', 'violence', 'fraud', 'misinformation'];
    const labels = ['不當內容', '暴力', '詐騙', '不實資訊'];
    const reason = prompt(`檢舉原因：\n1. 不當內容\n2. 暴力\n3. 詐騙\n4. 不實資訊\n\n請輸入數字(1-4)：`);
    if (!reason) return;
    const idx = parseInt(reason) - 1;
    if (idx >= 0 && idx < reasons.length) {
        reportEvent(eventID, reasons[idx]);
    }
}

async function reportEvent(eventID, reason) {
    try {
        const res = await fetch(`/api/reports/${eventID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason })
        });
        if (res.ok) alert('檢舉已送出');
    } catch (err) {
        console.error(err);
    }
}

// 排序
function setSort(sortBy, btn) {
    currentSort = sortBy;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadEvents(currentSort, '', currentCategory);
}

// 分類篩選
function setCategory(category, btn) {
    currentCategory = category;
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadEvents(currentSort, '', currentCategory);
}

// 搜尋
function searchEvents() {
    const keyword = document.getElementById('searchInput').value;
    loadEvents(currentSort, keyword, currentCategory);
}

// Enter 鍵搜尋
document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') searchEvents();
});

// 登出
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// 初始載入
loadEvents();