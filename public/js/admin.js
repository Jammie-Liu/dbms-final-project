const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
if (!token || role !== 'admin') window.location.href = '../login.html';

let currentTab = 'pending';
let currentEventID = null;
let currentEventVersion = 0;
let currentDraftID = null;

// 依據 tab 載入相對應的 event
async function loadEvents() {
    const list = document.getElementById('adminEventList');
    list.innerHTML = '<p class="no-events">載入中...</p>';

    const urlMap = {
        pending: '/api/admin/events/pending',
        reported: '/api/admin/events/reported',
        approved: '/api/admin/events/approved',
        rejected: '/api/admin/events/rejected',
        'reported-success': '/api/admin/events/reported-success',
        'pending-drafts': '/api/admin/events/pending-drafts'
    };

    const res = await fetch(urlMap[currentTab], {
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
                        : currentTab === 'reported-success'
                            ? `<span class="status-tag cancelled">🔴 檢舉成立</span>`
                            : currentTab === 'pending-drafts'
                                ? ` <span class="status-tag soon">修改待審核</span>`
                                : `<span class="status-tag soon">待審核</span>`
            }
            ${event.status === 'cancelled' ? '<span class="status-tag cancelled">已取消</span>' : ''}
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
                    被檢舉 ${event.reportCount} 次 ・
                    屬實 ${event.verifiedCount || 0} 次
                </p>`
            : ''
        }
        ${currentTab === 'reported-success'
          ? `<p style="color:var(--danger);font-size:13px;margin-top:4px">
              總檢舉 ${event.reportCount} 次 ・
              屬實 ${event.verifiedCount} 次
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

    // 存起來等等送審核時帶上
    currentEventVersion = event.version;

    // 如果是被檢舉的 tab，也抓檢舉詳情
    let reportSection = '';
    if (currentTab === 'reported') {
        const reportRes = await fetch(`/api/admin/events/${eventID}/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const reports = await reportRes.json();

        // 計算統計
        const totalReports = reports.length;
        const verifiedCount = reports.filter(r => r.isVerified === 1).length;
        const canConfirm = totalReports >= 5 && verifiedCount >= 3;

        reportSection = `
            <hr style="margin:16px 0">
            <h3 style="margin-bottom:12px;color:var(--danger)">🚨 檢舉列表</h3>

            <div style="background:#fef2f2;border-radius:var(--radius-md);
                padding:12px 16px;margin-bottom:16px;
                display:flex;justify-content:space-between;align-items:center"
                data-total="${totalReports}"
                data-verified="${verifiedCount}">
                <p style="font-size:14px;color:var(--danger)">
                    總檢舉 <b>${totalReports}</b> 次 ・ 屬實 <b>${verifiedCount}</b> 次
                </p>
                ${!canConfirm ? `
                    <p style="font-size:12px;color:var(--text-tertiary)">
                    需總檢舉 ≥ 5 且屬實 ≥ 3 才可核實
                    </p>
                ` : ''}
            </div>

            <div style="display:flex;flex-direction:column;gap:10px">
                ${reports.map(r => `
                    <div style="background:var(--bg);border-radius:var(--radius-md);
                    padding:14px 16px;border:1px solid var(--border)">
                        <div style="display:flex;justify-content:space-between;
                            align-items:flex-start;margin-bottom:8px">
                            <div>
                                <p style="font-weight:600;font-size:14px">
                                    ${getReasonLabel(r.reason)}
                                </p>
                                <p style="font-size:12px;color:var(--text-tertiary)">
                                    👤 ${r.reporterName} ・
                                    ${new Date(r.createdAt).toLocaleDateString('zh-TW')}
                                </p>
                            </div>
                            <div style="display:flex;gap:8px">
                                ${r.isVerified === null ? `
                                    <button onclick="verifyReport(${r.reportID}, true, ${r.version})"
                                    style="width:auto;padding:6px 12px;margin:0;font-size:12px;
                                    background:#dcfce7;color:#15803d;border:1px solid #86efac">
                                    ✅ 屬實
                                    </button>
                                    <button onclick="verifyReport(${r.reportID}, false, ${r.version})"
                                    style="width:auto;padding:6px 12px;margin:0;font-size:12px;
                                    background:#fef2f2;color:var(--danger);border:1px solid #fecaca">
                                    ❌ 不實
                                    </button>
                                ` : `
                                    <span class="status-tag ${r.isVerified === 1 ? 'open' : 'cancelled'}">
                                    ${r.isVerified === 1 ? '✅ 屬實' : '❌ 不實'}
                                    </span>
                                `}
                            </div>
                        </div>
                        ${r.detail ? `
                            <p style="font-size:13px;color:var(--text-secondary);
                            background:white;padding:8px 12px;border-radius:var(--radius-sm);
                            border:1px solid var(--border)">
                            ${r.detail}
                            </p>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
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
            <p>📅 活動時間：${new Date(event.eventTime).toLocaleString('zh-TW')} - ${new Date(event.eventEndTime).toLocaleString('zh-TW')}</p>
            <p>📍 地點：${event.location}</p>
            <p>💰 費用：${event.fee > 0 ? event.fee + ' 元' : '免費'}</p>
            ${event.registrationDeadline
                ? `<p>⏰ 報名截止：${new Date(event.registrationDeadline).toLocaleString('zh-TW')}</p>`
                : ''
            }
            ${event.registrationLink
                ? `<p>🔗 報名連結：<a href="${event.registrationLink}" target="_blank">點選此處前往報名網址</a></p>`
                : ''
            }
            ${event.hashtags && event.hashtags.length > 0
                ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                    <span>🏷️</span>
                    ${event.hashtags.map(tag => `
                        <span style="background:var(--brand-light);color:var(--brand);
                            padding:4px 10px;border-radius:20px;font-size:13px;font-weight:500">
                            #${tag}
                        </span>
                    `).join('')}
                    </div>`
                : ''
            }
            ${event.hasMeal ? '<p>🍱 附餐食</p>' : ''}
            ${event.hasGift ? '<p>🎁 附贈品</p>' : ''}
        </div>
        <hr style="margin-bottom:16px">
        <h3 style="margin-bottom:8px">活動說明</h3>
        <p style="line-height:1.7" id="description">${event.description}</p>
        ${reportSection}
        ${auditLogSection}
    `;

    if (currentTab === 'reported') {
        // 被檢舉 tab：隱藏通過/不通過，顯示檢舉核實按鈕
        document.getElementById('approveBtn').style.display = 'none';
        document.getElementById('rejectBtn').style.display = 'none';
        document.getElementById('confirmReportBtn').style.display = 'block';

        // 判斷是否達到條件
        const totalReports = parseInt(document.querySelector('#detailContent [data-total]')?.dataset.total || 0);
        const verifiedCount = parseInt(document.querySelector('#detailContent [data-verified]')?.dataset.verified || 0);
        const canConfirm = totalReports >= 5 && verifiedCount >= 3;

        const btn = document.getElementById('confirmReportBtn');
        btn.disabled = !canConfirm;
        btn.style.background = canConfirm ? 'var(--danger)' : 'var(--border)';
        btn.style.color = canConfirm ? 'white' : 'var(--text-tertiary)';
        btn.style.cursor = canConfirm ? 'pointer' : 'not-allowed';
    } else if (currentTab === 'approved' || currentTab === 'rejected' || currentTab === 'reported-success') {
        document.getElementById('approveBtn').style.display = 'none';
        document.getElementById('rejectBtn').style.display = 'none';
        document.getElementById('confirmReportBtn').style.display = 'none';
    } else {
        document.getElementById('approveBtn').style.display = 'block';
        document.getElementById('rejectBtn').style.display = 'block';
        document.getElementById('confirmReportBtn').style.display = 'none';
    }

    document.getElementById('detailPopup').style.display = 'flex';

    if (currentTab === 'pending-drafts') {
        const draftRes = await fetch(`/api/admin/events/pending-drafts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const drafts = await draftRes.json();
        const draft = drafts.find(d => d.eventID === eventID);

        if (draft) {
            draftSection = `
                <hr style="margin:16px 0">
                <h3 style="margin-bottom:12px;color:var(--brand)">✏️ 修改版本內容</h3>
                <div style="background:var(--brand-light);border-radius:var(--radius-md);padding:16px">
                    <h3>${draft.title}</h3>
                    ${draft.imageURL
                        ? `<img src="${draft.imageURL}" style="width:100%;border-radius:12px;margin-bottom:16px">`
                        : ''
                    }
                    <p>🗂️ 分類：${categoryMap[draft.category] || draft.category}</p>
                    <p>👤 主辦人：${draft.organizerName}</p>
                    <p>📅 時間：${new Date(draft.eventTime).toLocaleString('zh-TW')} - ${new Date(draft.eventEndTime).toLocaleString('zh-TW')}</p>
                    <p>📍 地點：${draft.location}</p>
                    <p>💰 費用：${draft.fee > 0 ? draft.fee + ' 元' : '免費'}</p>
                    ${draft.registrationDeadline
                        ? `<p>⏰ 報名截止：${new Date(draft.registrationDeadline).toLocaleString('zh-TW')}</p>`
                        : ''
                    }
                    ${draft.registrationLink
                        ? `<p>🔗 報名連結：<a href="${draft.registrationLink}" target="_blank">點選此處前往報名網址</a></p>`
                        : ''
                    }
                    ${draft.hashtags && draft.hashtags.length > 0
                        ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                            <span>🏷️ hashtags：</span>
                            ${draft.hashtags.map(tag => `
                                <span style="background:white;color:var(--brand);
                                    padding:4px 10px;border-radius:20px;font-size:13px;font-weight:500">
                                    #${tag}
                                </span>
                            `).join('')}
                            </div>`
                        : ''
                    }
                    ${draft.hasMeal ? '<p>🍱 附餐食</p>' : ''}
                    ${draft.hasGift ? '<p>🎁 附贈品</p>' : ''}
                    <p>📄 說明：</p>
                    <p id="description">${draft.description}</p>
                    ${auditLogSection}
                </div>
            `;

            document.getElementById('detailContent').innerHTML = draftSection;

            // 改變按鈕行為
            document.getElementById('approveBtn').onclick = () => auditDraft(draft.draftID, 'approved');
            document.getElementById('rejectBtn').onclick = () => {
                currentDraftID = draft.draftID;
                document.getElementById('rejectReason').value = '';
                document.getElementById('rejectPopup').style.display = 'flex';
            };
        }
    }
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

  if (currentTab === 'pending-drafts') {
    await auditDraft(currentDraftID, 'rejected', reason, comment);
  } else {
    const auditReason = currentTab === 'reported' ? 'reported' : 'general';
    await audit(currentEventID, 'rejected', reason, comment, auditReason);
  }

  closeRejectPopup();
  closeDetail();
}

async function auditDraft(draftID, result, rejectReason, comment) {
  const res = await fetch(`/api/admin/drafts/${draftID}/audit`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ result, rejectReason, comment })
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.message);
    if (res.status === 409) {
      // 版本衝突：重新整理活動列表
      closeDetail();
      loadEvents();
    }
    return;
  }

  closeDetail();
  loadEvents();
}

async function audit(eventID, result, rejectReason, comment, auditReason) {
  const res = await fetch(`/api/admin/events/${eventID}/audit`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ result, rejectReason, comment, auditReason, version: currentEventVersion })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    if (res.status === 409) {
      // 版本衝突：重新整理活動列表
      closeDetail();
      loadEvents();
    }
    return;
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

async function verifyReport(reportID, isVerified, version) {
  await fetch(`/api/admin/reports/${reportID}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ isVerified, version })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    if (res.status === 409) {
      viewDetail(currentEventID); // 重新載入
    }
    return;
  }

  // 重新載入 View Detail
  viewDetail(currentEventID);
}

async function confirmReport(eventID) {
  if (!confirm('確定要核實此檢舉嗎？\n活動將被下架，主辦人將被封鎖 1 年。')) return;

  const res = await fetch(`/api/admin/events/${eventID}/confirm-report`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await res.json();

  if (res.ok) {
    alert('檢舉核實成功！');
    closeDetail();
    loadEvents();
  } else {
    alert(data.message);
  }
}

loadEvents();