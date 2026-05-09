// 檢查是否登入
const token = localStorage.getItem('token');
const userID = localStorage.getItem('userID');
const username = localStorage.getItem('username');
const role = localStorage.getItem('role');

if (!token) {
  window.location.href = 'login.html';
}

const welcomeEl = document.getElementById('welcomeText');
if (welcomeEl) welcomeEl.textContent = `Hi, ${username}`;

// 顯示角色
const roleText = document.getElementById('roleText');
if (roleText) roleText.textContent = role === 'admin' ? '管理員' : '學生';

// 顯示使用者名稱首字作為頭像
const avatar = document.getElementById('userAvatar');
if (avatar && username) {
  avatar.textContent = username.charAt(0).toUpperCase();
}

// 管理員才顯示管理員連結
if (role === 'admin') {
  const adminLink = document.getElementById('adminLink');
  if (adminLink) adminLink.style.display = 'flex';
}

let currentSort = 'default';
let currentCategory = '';

// 搜尋框 focus
function focusSearch() {
  document.getElementById('searchInput').focus();
}

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
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadEvents(currentSort, '', [...selectedCategories].join(','));
}

// 分類篩選
let selectedCategories = new Set();

function setCategory(category, btn) {
  if (category === '') {
    selectedCategories.clear();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadEvents(currentSort, '', '');
    return;
  }

  const allBtn = document.querySelector('.tab-btn[data-cat=""]');
  if (allBtn) allBtn.classList.remove('active');

  if (selectedCategories.has(category)) {
    selectedCategories.delete(category);
    btn.classList.remove('active');
  } else {
    selectedCategories.add(category);
    btn.classList.add('active');
  }

  if (selectedCategories.size === 0) {
    if (allBtn) allBtn.classList.add('active');
    loadEvents(currentSort, '', '');
    return;
  }

  loadEvents(currentSort, '', [...selectedCategories].join(','));
}

function searchEvents() {
  const keyword = document.getElementById('searchInput').value;

  if (keyword) {
    // 有關鍵字就用 search API（支援 LIKE）
    loadEventsWithFilter({
      keyword,
      date: document.getElementById('filterDate')?.value || '',
      location: document.getElementById('filterLocation')?.value || '',
      fee: document.getElementById('filterFee')?.value || '',
      hasMeal: document.getElementById('filterMeal')?.checked || false,
      hasGift: document.getElementById('filterGift')?.checked || false,
      category: [...selectedCategories].join(',')
    });
  } else {
    // 沒有關鍵字就用一般載入
    loadEvents(currentSort, '', [...selectedCategories].join(','));
  }
}

function toggleSearchBtn() {
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('searchBtn');
  if (input.value.trim()) {
    btn.disabled = false;
    btn.style.background = 'var(--brand)';
    btn.style.color = 'white';
    btn.style.cursor = 'pointer';
  } else {
    btn.disabled = true;
    btn.style.background = 'var(--border)';
    btn.style.color = 'var(--text-tertiary)';
    btn.style.cursor = 'not-allowed';
  }
}

// Enter 鍵搜尋
document.getElementById('searchInput').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') searchEvents();
});

// 切換篩選面板
function toggleFilter() {
  const panel = document.getElementById('filterPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// 套用篩選
function applyFilter() {
  const keyword = document.getElementById('searchInput').value;
  const date = document.getElementById('filterDate').value;
  const location = document.getElementById('filterLocation').value;
  const fee = document.getElementById('filterFee').value;
  const hasMeal = document.getElementById('filterMeal').checked;
  const hasGift = document.getElementById('filterGift').checked;
  const category = [...selectedCategories].join(',');

  loadEventsWithFilter({ keyword, date, location, fee, hasMeal, hasGift, category });
}

// 清除篩選
function clearFilter() {
  document.getElementById('filterDate').value = '';
  document.getElementById('filterLocation').value = '';
  document.getElementById('filterFee').value = '';
  document.getElementById('filterMeal').checked = false;
  document.getElementById('filterGift').checked = false;
  loadEvents(currentSort, '', [...selectedCategories].join(','));
}

// 帶條件載入活動
async function loadEventsWithFilter({ keyword, date, location, fee, hasMeal, hasGift, category }) {
  const eventList = document.getElementById('eventList');
  eventList.innerHTML = '<p class="no-events"><span class="no-events-icon">⏳</span>載入中...</p>';

  try {
    let url = `/api/events/search?`;
    const params = new URLSearchParams();

    if (keyword) params.append('keyword', keyword);
    if (date) params.append('date', date);
    if (location) params.append('location', location);
    if (fee) params.append('fee', fee);
    if (hasMeal) params.append('hasMeal', 'true');
    if (hasGift) params.append('hasGift', 'true');
    if (category) params.append('category', category);

    url += params.toString();

    const [eventsRes, favRes] = await Promise.all([
      fetch(url),
      fetch('/api/users/favorites', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    const events = await eventsRes.json();
    const favData = await favRes.json();
    favoritedEventIDs = new Set(favData.map(f => f.eventID));

    if (events.length === 0) {
      eventList.innerHTML = '<p class="no-events"><span class="no-events-icon">🔍</span>找不到符合條件的活動</p>';
      return;
    }

    eventList.innerHTML = events.map((event, i) => renderEventCard(event, i)).join('');
  } catch (err) {
    eventList.innerHTML = '<p class="no-events">載入失敗，請重試</p>';
    console.error(err);
  }
}
// 初始載入
loadEvents();
