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
  const eventEndTime = event.eventEndTime ? `- ${new Date(event.eventEndTime).toLocaleDateString('zh-TW')}` : '';
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
        ${event.auditStatus === 'draft_pending' ? `
          <div style="display:flex;align-items:center;gap:6px;
            background:#fff7ed;border-radius:var(--radius-sm);
            padding:6px 10px;margin-bottom:10px;
            border:1px solid #fed7aa">
            <span style="font-size:14px">⚠️</span>
            <p style="font-size:12px;color:#c2410c;margin:0">
              活動修改中，資訊可能尚未更新
            </p>
          </div>
        ` : ''}
        <span class="category-tag">${categoryLabel.emoji} ${categoryLabel.text}</span>
        <h3>${event.title}</h3>
        <div class="card-meta">
          <p>📅 ${eventTime} ${eventEndTime}</p>
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
  const eventEndTime = event.eventEndTime ? new Date(event.eventEndTime) : null;
  const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

  // 有結束時間就用結束時間判斷，沒有就用開始時間
  const endTime = eventEndTime || eventTime;
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

let reportTargetEventID = null;

const reasonLabels = {
  inappropriate: '🔞 色情／不當內容',
  violence: '⚠️ 暴力',
  fraud: '💰 詐騙',
  misinformation: '❌ 不實資訊',
  other: '💬 其他'
};

function showReportMenu(eventID) {
  reportTargetEventID = eventID;
  // 清除上次的選擇
  document.querySelectorAll('input[name="reportReason"]').forEach(r => r.checked = false);
  document.getElementById('reportDetail').value = '';
  document.getElementById('reportStep1').style.display = 'block';
  document.getElementById('reportStep2').style.display = 'none';
  document.getElementById('reportPopup').style.display = 'flex';
}

function closeReportPopup() {
  document.getElementById('reportPopup').style.display = 'none';
  reportTargetEventID = null;
}

function goToReportStep2() {
  const selected = document.querySelector('input[name="reportReason"]:checked');
  if (!selected) {
    alert('請選擇檢舉原因！');
    return;
  }

  // 顯示選擇的原因標籤
  document.getElementById('selectedReasonTag').textContent = reasonLabels[selected.value];
  document.getElementById('reportStep1').style.display = 'none';
  document.getElementById('reportStep2').style.display = 'block';

  // 如果選「其他」，監聽 textarea 決定按鈕狀態
  const submitBtn = document.querySelector('#reportStep2 button[onclick="submitReport()"]');
  const detailTextarea = document.getElementById('reportDetail');

  if (selected.value === 'other') {
    // 初始設為灰色不可按
    submitBtn.disabled = true;
    submitBtn.style.background = 'var(--border)';
    submitBtn.style.color = 'var(--text-tertiary)';
    submitBtn.style.cursor = 'not-allowed';

    // 監聽輸入，有內容才可按
    detailTextarea.oninput = function () {
      const hasContent = detailTextarea.value.trim().length > 0;
      submitBtn.disabled = !hasContent;
      submitBtn.style.background = hasContent ? 'var(--danger)' : 'var(--border)';
      submitBtn.style.color = hasContent ? 'white' : 'var(--text-tertiary)';
      submitBtn.style.cursor = hasContent ? 'pointer' : 'not-allowed';
    };
  } else {
    // 非「其他」，按鈕正常可按
    submitBtn.disabled = false;
    submitBtn.style.background = 'var(--danger)';
    submitBtn.style.color = 'white';
    submitBtn.style.cursor = 'pointer';
    detailTextarea.oninput = null;
  }
}

function backToReportStep1() {
  document.getElementById('reportStep1').style.display = 'block';
  document.getElementById('reportStep2').style.display = 'none';
}

async function submitReport() {
  const selected = document.querySelector('input[name="reportReason"]:checked');
  const detail = document.getElementById('reportDetail').value;

  // 選「其他」但沒填說明
  if (selected.value === 'other' && !detail) {
    alert('選擇「其他」時請填寫詳細說明！');
    return;
  }

  try {
    const res = await fetch(`/api/reports/${reportTargetEventID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reason: selected.value,
        detail: detail || null
      })
    });

    if (res.ok) {
      closeReportPopup();
      alert('檢舉已送出，感謝你的回報！');
    }
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
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
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

  // 關閉篩選 popup
  document.getElementById('filterPanel').style.display = 'none';
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

function showDeleteFolder() {
  document.getElementById('deleteFolderPopup').style.display = 'flex';
}

function closeDeleteFolder() {
  document.getElementById('deleteFolderPopup').style.display = 'none';
}

async function confirmDeleteFolder() {
  await fetch(`/api/users/favorites/folders/${currentFolderID}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  closeDeleteFolder();
  currentFolderID = null;
  document.getElementById('deleteFolderBtn').style.display = 'none';
  loadFolders();
  loadFavorites();
}

let notifOpen = false;

async function loadNotifications() {
  try {
    const res = await fetch('/api/notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const notifications = await res.json();

    // 更新未讀數量
    const unread = notifications.filter(n => !n.isRead).length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // 更新通知列表
    const list = document.getElementById('notifList');
    if (!list) return;

    if (notifications.length === 0) {
      list.innerHTML = `
        <p style="text-align:center;padding:24px;color:var(--text-tertiary)">
          沒有通知
        </p>`;
      return;
    }

    list.innerHTML = notifications.map(n => `
      <div onclick="readNotif(${n.notificationID}, ${n.eventID}, '${n.message.replace(/'/g, "\\'")}')"
        style="padding:14px 20px;border-bottom:1px solid var(--border);
        cursor:pointer;transition:background 0.15s;
        background:${n.isRead ? 'white' : '#eff6ff'}">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:20px;flex-shrink:0">
            ${n.message.includes('審核') ? '📋' : '🔔'}
          </span>
          <div style="flex:1">
            <p style="font-size:13px;color:var(--text-primary);
              line-height:1.5;margin-bottom:4px">
              ${n.message}
            </p>
            <p style="font-size:11px;color:var(--text-tertiary)">
              ${new Date(n.createdAt).toLocaleString('zh-TW')}
            </p>
          </div>
          ${!n.isRead
            ? `<span style="width:8px;height:8px;border-radius:50%;
                background:var(--brand);flex-shrink:0;margin-top:4px"></span>`
            : ''
          }
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
  }
}

function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  notifOpen = !notifOpen;
  panel.style.display = notifOpen ? 'block' : 'none';
  if (notifOpen) loadNotifications();
}

async function readNotif(notificationID, eventID, message) {
  // 標記已讀
  await fetch(`/api/notifications/${notificationID}/read`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // 根據通知類型決定跳轉頁面
  if (message.includes('審核通過') || message.includes('審核未通過')) {
    // 審核通知 → 跳到我的活動頁面
    window.location.href = `my-events.html`;
  } else {
    // 報名截止提醒 → 跳到活動詳情
    window.location.href = `event.html?id=${eventID}`;
  }
}

async function markAllRead() {
  await fetch('/api/notifications/read-all', {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  loadNotifications();
}

// 點外面關閉通知面板
document.addEventListener('click', (e) => {
  // 關閉通知面板
  const notifPanel = document.getElementById('notifPanel');
  const filterPanel = document.getElementById('filterPanel');

  if (notifPanel && !notifPanel.contains(e.target) && !e.target.closest('.icon-btn')) {
    notifPanel.style.display = 'none';
    notifOpen = false;
  }

  // 關閉篩選面板（點外面且不是 ⚙️ 按鈕）
  if (filterPanel && filterPanel.style.display !== 'none') {
    if (!filterPanel.contains(e.target) && !e.target.closest('[onclick="toggleFilter()"]')) {
      filterPanel.style.display = 'none';
    }
  }
});

// 每 60 秒自動更新通知數量
setInterval(loadNotifications, 60000);

// 初始載入通知
loadNotifications();

// 初始載入
loadEvents();
