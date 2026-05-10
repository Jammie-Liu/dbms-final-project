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
        <div class="user-chip">
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

  // 讓 body 變成 flex 三欄佈局
  document.body.style.display = 'flex';

}

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
