// 自動插入側邊欄到每個頁面
function renderSidebar() {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const role = localStorage.getItem('role');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // 判斷目前在哪個頁面，讓對應的 nav-item 變藍
  const currentPage = window.location.pathname.split('/').pop();
  const navItems = {
    'index.html': '首頁',
    'create-event.html': '新增活動',
    'history.html': '瀏覽紀錄',
    'favorites.html': '我的收藏',
    'my-events.html': '我的活動',
  };

  const sidebarHTML = `
    <aside class="sidebar">
      <div class="sidebar-logo">🎯 學生活動資訊平台</div>

      <nav class="sidebar-nav">
        <p class="nav-label">MAIN MENU</p>
        <a href="index.html" class="nav-item ${currentPage === 'index.html' ? 'active' : ''}">
          <span>🏠</span> Home
        </a>
        <a href="create-event.html" class="nav-item ${currentPage === 'create-event.html' ? 'active' : ''}">
          <span>➕</span> Create Event
        </a>
        <a href="history.html" class="nav-item ${currentPage === 'history.html' ? 'active' : ''}">
          <span>🕐</span> History
        </a>
        <a href="favorites.html" class="nav-item ${currentPage === 'favorites.html' ? 'active' : ''}">
          <span>❤️</span> Favorites
        </a>
        <a href="my-events.html" class="nav-item ${currentPage === 'my-events.html' ? 'active' : ''}">
          <span>📋</span> My Events
        </a>
        ${role === 'admin' ? `
        <a href="admin/index.html" class="nav-item ${currentPage === 'index.html' && window.location.pathname.includes('admin') ? 'active' : ''}">
          <span>⚙️</span> Admin
        </a>` : ''}
      </nav>

      <div class="sidebar-bottom">
        <div class="user-chip"  onclick="openProfileModal()" style="cursor:pointer">
          <div class="user-avatar">${username ? username.charAt(0).toUpperCase() : '?'}</div>
          <div>
            <p style="font-weight:600;font-size:14px">${username || ''}</p>
            <p style="font-size:12px;color:var(--text-tertiary)">${role === 'admin' ? '管理員' : '學生'}</p>
          </div>
        </div>
        <button class="logout-btn" onclick="window.logout()">登出</button>
      </div>
    </aside>
  `;
  // 插入到 body 最前面
  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // 插入個資編輯 modal
  document.body.insertAdjacentHTML('beforeend', `
    <div id="profileModal" class="popup-overlay"
      style="display:none;align-items:center;justify-content:center">
      <div class="popup-box" style="border-radius:var(--radius-xl);max-width:440px;width:90%">
        <div class="popup-handle"></div>
        <h3 style="margin-bottom:20px">編輯個人資料</h3>

        <div class="form-group">
          <label style="font-size:14px;font-weight:500;margin-bottom:8px;display:block">
            使用者名稱
          </label>
          <input type="text" id="profileUsername" placeholder="輸入新名稱">
        </div>

        <hr style="margin:20px 0">
        <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:16px">
          如不修改密碼，請留空
        </p>

        <div class="form-group">
          <label style="font-size:14px;font-weight:500;margin-bottom:8px;display:block">
            目前密碼
          </label>
          <input type="password" id="profileCurrentPassword"
            placeholder="輸入目前密碼" autocomplete="current-password">
        </div>

        <div class="form-group">
          <label style="font-size:14px;font-weight:500;margin-bottom:8px;display:block">
            新密碼
          </label>
          <input type="password" id="profileNewPassword"
            placeholder="8~12 字元，含數字和英文" autocomplete="new-password">
        </div>

        <p id="profileMessage" style="font-size:13px;margin-bottom:12px;
          text-align:center;display:none"></p>

        <div style="display:flex;gap:10px;margin-top:8px;
          padding-top:16px;border-top:1px solid var(--border)">
          <button onclick="closeProfileModal()" style="
            flex:1;margin:0;background:var(--bg);
            color:var(--text-primary);border:1.5px solid var(--border)">
            取消
          </button>
          <button onclick="saveProfile()" style="flex:1;margin:0">
            儲存
          </button>
        </div>
      </div>
    </div>
  `);

  // 讓 body 變成 flex 三欄佈局
  document.body.style.display = 'flex';

}

window.openProfileModal = function() {
  const username = localStorage.getItem('username');
  document.getElementById('profileUsername').value = username || '';
  document.getElementById('profileCurrentPassword').value = '';
  document.getElementById('profileNewPassword').value = '';
  const msg = document.getElementById('profileMessage');
  msg.style.display = 'none';
  document.getElementById('profileModal').style.display = 'flex';
};

window.closeProfileModal = function() {
  document.getElementById('profileModal').style.display = 'none';
};

window.saveProfile = async function() {
  const token = localStorage.getItem('token');
  const username = document.getElementById('profileUsername').value.trim();
  const currentPassword = document.getElementById('profileCurrentPassword').value;
  const newPassword = document.getElementById('profileNewPassword').value;
  const msg = document.getElementById('profileMessage');

  try {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username, currentPassword, newPassword })
    });

    const data = await res.json();
    msg.style.display = 'block';

    if (res.ok) {
      msg.textContent = '✅ 更新成功！';
      msg.style.color = 'var(--success)';

      // 更新 localStorage 的 username
      if (username) {
        localStorage.setItem('username', username);
      }

      setTimeout(() => {
        closeProfileModal();
        window.location.reload(); // 重新整理更新頭像首字
      }, 1000);
    } else {
      msg.textContent = '❌ ' + data.message;
      msg.style.color = 'var(--danger)';
    }
  } catch (err) {
    msg.textContent = '❌ 伺服器錯誤';
    msg.style.color = 'var(--danger)';
    msg.style.display = 'block';
  }
};

window.logout = function() {
  localStorage.clear();
  const path = window.location.pathname;
  if (path.includes('/admin/')) {
    window.location.href = '../login.html';
  } else {
    window.location.href = '/login.html';  // ← 用絕對路徑
  }
}

// 頁面載入時自動執行
renderSidebar();
