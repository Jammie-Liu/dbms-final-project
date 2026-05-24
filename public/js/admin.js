const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
if (!token || role !== 'admin') window.location.href = '../login.html';

let currentTab = 'pending';
let currentEventID = null;

// 依據 tab 載入相對應的 event
async function loadEvents() {
    const list = document.getElementById('adminEventList');
    list.innerHTML = '<p class="no-events">載入中...</p>';

    let url = '';
    if (currentTab === 'pending') url = '/api/admin/events/pending';
    else if (currentTab === 'reported') url = '/api/admin/events/reported';
    else if (currentTab === 'approved') url = '/api/admin/events/approved';
    else if (currentTab === 'rejected') url = '/api/admin/events/rejected';

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const events = await res.json();

    if (events.length === 0) {
        list.innerHTML = '<p class="no-events"><span class="no-events-icon">✅</span>沒有待處理的活動</p>';
        return;
    }

    list.innerHTML = events.map(event => `
    <div class="event-card" style="display:flex;flex-direction:column">
        <div class="card-top">
        ${currentTab === 'reported'
            ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
                ${event.reportReasons.split(',').map(r => `
                <span class="status-tag cancelled">${getReasonLabel(r)}</span>
                `).join('')}
            </div>`
            : currentTab === 'approved'
            ? `<span class="status-tag open">已通過</span>`
            : currentTab === 'rejected'
                ? `<span class="status-tag cancelled">已退件</span>`
                : `<span class="status-tag soon">待審核</span>`
        }
        </div>
        <div class="card-body" style="flex:1">
        <h3>${event.title}</h3>
        <p>👤 ${event.organizerName}</p>
        <p>📅 ${new Date(event.eventTime).toLocaleDateString('zh-TW')}${event.eventEndTime
            ? ` - ${new Date(event.eventEndTime).toLocaleDateString('zh-TW')}`
            : ''
        }</p>
        <p>📍 ${event.location}</p>
        ${currentTab === 'reported'
        ? `<p style="color:var(--danger);font-size:13px;margin-top:4px">
                被檢舉 ${event.reportCount} 次
            </p>`
        : ''
        }
        ${currentTab === 'rejected' && event.rejectReason ? `
            <div style="margin-top:10px;padding:10px 12px;background:#fef2f2;
            border-radius:var(--radius-sm);border:1px solid #fecaca">
            <p style="font-size:12px;font-weight:600;color:var(--danger);margin-bottom:4px">
                退件原因
            </p>
            <p style="font-size:13px;color:var(--text-secondary)">${event.rejectReason}</p>
            </div>
        ` : ''}
        </div>
        <div style="padding:0 16px 16px">
            <button onclick="viewDetail(${event.eventID})"
                style="width:100%;padding:8px 16px;background:var(--bg);
                color:var(--text-primary);border:1.5px solid var(--border);font-size:13px">
                👁️ View Detail
            </button>
        </div>
    </div>
    `).join('');
}

// 檢舉原因中文標籤
function getReasonLabel(reason) {
    const map = {
    inappropriate: '不當內容',
    violence: '暴力',
    fraud: '詐騙',
    misinformation: '不實資訊'
    };
    return map[reason.trim()] || reason;
}

// 查看詳細資訊
async function viewDetail(eventID) {
    currentEventID = eventID;

    const res = await fetch(`/api/events/${eventID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const event = await res.json();

    // 如果是被檢舉的 tab，也抓檢舉詳情
    let reportSection = '';
    if (currentTab === 'reported') {
        const reportRes = await fetch(`/api/admin/events/reported`, {
        headers: { 'Authorization': `Bearer ${token}` }
        });
        const reportedEvents = await reportRes.json();
        const reportedEvent = reportedEvents.find(e => e.eventID === eventID);

        if (reportedEvent) {
        const reasons = reportedEvent.reportReasons
            ? reportedEvent.reportReasons.split(',').map(r => getReasonLabel(r.trim())).join('、')
            : '';
        const details = reportedEvent.reportDetails
            ? reportedEvent.reportDetails.split('|').map(d => d.trim()).filter(d => d && d !== 'null')
            : [];

        reportSection = `
            <hr style="margin:16px 0">
            <h3 style="margin-bottom:12px;color:var(--danger)">🚨 檢舉資訊</h3>
            <div style="background:#fef2f2;border-radius:var(--radius-md);padding:16px">
                <p style="margin-bottom:8px">
                    <b>檢舉次數：</b>${reportedEvent.reportCount} 次
                </p>
                <p style="margin-bottom:8px">
                    <b>檢舉原因：</b>${reasons}
                </p>
                ${details.length > 0 ? `
                    <div style="margin-top:12px">
                        <b>檢舉詳情：</b>
                        <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
                            ${details.map((d, i) => `
                            <div style="background:white;border-radius:var(--radius-sm);
                                padding:10px 14px;font-size:13px;color:var(--text-secondary);
                                border:1px solid #fecaca">
                                ${i + 1}. ${d}
                            </div>
                            `).join('')}
                        </div>
                    </div>
                ` : '<p style="margin-top:8px;color:var(--text-tertiary);font-size:13px">無補充說明</p>'}
            </div>
        `;
        }
    }

    // 取得審核歷史
    const logRes = await fetch(`/api/admin/events/${eventID}/audit-log`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const logs = await logRes.json();

    const auditLogSection = logs.length > 0 ? `
        <hr style="margin:16px 0">
        <h3 style="margin-bottom:12px">📋 審核歷史</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
            ${logs.map(log => `
                <div style="background:var(--bg);border-radius:var(--radius-md);
                    padding:14px 16px;border:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;
                        align-items:center;margin-bottom:8px">
                        <span style="font-weight:600;font-size:14px">
                            第 ${log.ordinal_num} 次審核
                        </span>
                        <span class="status-tag ${log.result === 'approved' ? 'open' : 'cancelled'}">
                            ${log.result === 'approved' ? '✅ 通過' : '❌ 退件'}
                        </span>
                    </div>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:6px">
                        審核類型：${log.audit_reason === 'general' ? '一般審核' : '檢舉審核'} ・
                        審核人：${log.adminName} ・
                        ${new Date(log.audit_time).toLocaleString('zh-TW')}
                    </p>
                    ${log.result === 'rejected' && log.rejectReason ? `
                        <div style="background:#fef2f2;border-radius:var(--radius-sm);
                            padding:8px 12px;margin-top:6px">
                            <p style="font-size:13px;color:var(--danger)">
                                退件原因：${log.rejectReason}
                            </p>
                        </div>
                    ` : ''}
                    ${log.comment ? `
                        <p style="font-size:12px;color:var(--text-tertiary);
                            margin-top:6px;font-style:italic">
                            備註：${log.comment}
                        </p>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    const categoryMap = {
        career: '🎓 職涯與學術成長',
        arts: '🎨 藝文與生活體驗',
        social: '🎉 社團與社交娛樂',
        volunteer: '🤝 志願服務與社會參與'
    };

    document.getElementById('detailContent').innerHTML = `
        <h2 style="margin-bottom:16px">${event.title}</h2>
        ${event.imageURL
            ? `<img src="${event.imageURL}" style="width:100%;border-radius:12px;margin-bottom:16px">`
            : ''
        }
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
            <p>🗂️ ${categoryMap[event.category] || event.category}</p>
            <p>👤 主辦人：${event.organizerName}</p>
            <p>📅 活動時間：${new Date(event.eventTime).toLocaleString('zh-TW')}</p>
            <p>📍 地點：${event.location}</p>
            <p>💰 費用：${event.fee > 0 ? event.fee + ' 元' : '免費'}</p>
            ${event.registrationDeadline
                ? `<p>⏰ 報名截止：${new Date(event.registrationDeadline).toLocaleString('zh-TW')}</p>`
                : ''
            }
            ${event.registrationLink
                ? `<p>🔗 報名連結：<a href="${event.registrationLink}" target="_blank">${event.registrationLink}</a></p>`
                : ''
            }
            ${event.hashtag ? `<p>🏷️ ${event.hashtag}</p>` : ''}
            ${event.hasMeal ? '<p>🍱 附餐食</p>' : ''}
            ${event.hasGift ? '<p>🎁 附贈品</p>' : ''}
        </div>
        <hr style="margin-bottom:16px">
        <h3 style="margin-bottom:8px">活動說明</h3>
        <p style="line-height:1.7">${event.description}</p>
        ${reportSection}
        ${auditLogSection}
    `;

    // 已通過或退件的活動，隱藏審核按鈕
    if (currentTab === 'approved' || currentTab === 'rejected') {
        document.getElementById('approveBtn').style.display = 'none';
        document.getElementById('rejectBtn').style.display = 'none';
    } else {
        document.getElementById('approveBtn').style.display = 'block';
        document.getElementById('rejectBtn').style.display = 'block';
    }

    document.getElementById('detailPopup').style.display = 'flex';

    
}

function closeDetail() {
    document.getElementById('detailPopup').style.display = 'none';
    currentEventID = null;
}

function auditFromDetail(result) {
  if (!currentEventID) return;
  if (result === 'rejected') {
    // 開退件理由 popup
    document.getElementById('rejectReason').value = '';
    document.getElementById('auditComment').value = '';
    document.getElementById('rejectPopup').style.display = 'flex';
  } else {
    // 通過：直接審核，帶入 auditReason
    const auditReason = currentTab === 'reported' ? 'reported' : 'general';
    audit(currentEventID, 'approved', null, null, auditReason);
    closeDetail();
  }
}

function closeRejectPopup() {
  document.getElementById('rejectPopup').style.display = 'none';
}

async function confirmReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  const comment = document.getElementById('auditComment').value.trim();
  if (!reason) {
    alert('請填寫退件原因！');
    return;
  }
  const auditReason = currentTab === 'reported' ? 'reported' : 'general';
  await audit(currentEventID, 'rejected', reason, comment, auditReason);
  closeRejectPopup();
  closeDetail();
}

async function audit(eventID, result, rejectReason, comment, auditReason) {
  const res = await fetch(`/api/admin/events/${eventID}/audit`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ result, rejectReason, comment, auditReason })
  });

  if (!res.ok) {
    const data = await res.json();
    alert(data.message);
  }

  loadEvents();
}

function setTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadEvents();
}

function logout() {
    localStorage.clear();
    window.location.href = '../login.html';
}

loadEvents();