if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('PWA Service Worker: 登録成功', reg))
      .catch(err => console.error('PWA Service Worker: 登録失敗', err));
  });
}

const firebaseConfig = {
  apiKey: "AIzaSyCW7Epy6bM_k4KhGvqnFNXkcLyp7xRqmO4",
  authDomain: "bukatsun-connect.firebaseapp.com",
  projectId: "bukatsun-connect",
  storageBucket: "bukatsun-connect.firebasestorage.app",
  messagingSenderId: "283549888321",
  appId: "1:283549888321:web:8339b7c00128dec49cfbc0",
  measurementId: "G-WDVC4CTGK4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function showNotification(message, type = 'warning') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.id = 'custom-toast';
  
  let bgColor = 'bg-amber-600 border-amber-500 shadow-amber-900/30';
  let icon = 'fa-triangle-exclamation';
  if (type === 'error') {
    bgColor = 'bg-rose-600 border-rose-500 shadow-rose-900/30';
    icon = 'fa-circle-exclamation';
  } else if (type === 'success') {
    bgColor = 'bg-emerald-600 border-emerald-500 shadow-emerald-900/30';
    icon = 'fa-circle-check';
  }

  toast.className = `flex items-center gap-3 ${bgColor} border text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-in pointer-events-auto w-full mb-2`;
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-sm"></i>
    <span class="tracking-wide">${message}</span>
  `;

  if (container) {
    container.appendChild(toast);
  } else {
    document.body.appendChild(toast);
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-15px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

let currentUser = { name: '', role: '' };
let activities = []; 
let selectedActivityDocId = ''; 

const currentDisplayDate = new Date();
let currentDisplayYear = currentDisplayDate.getFullYear();
let currentDisplayMonth = currentDisplayDate.getMonth() + 1;

let myPseudoIP = localStorage.getItem('BUKATSUn_MY_IP');
if (!myPseudoIP) {
  myPseudoIP = `192.168.10.${Math.floor(Math.random() * 254) + 1}`;
  localStorage.setItem('BUKATSUn_MY_IP', myPseudoIP);
}

const screenLogin = document.getElementById('screen-login');
const screenMember = document.getElementById('screen-member');
const screenCalendar = document.getElementById('screen-calendar');
const screenLeader = document.getElementById('screen-leader');
const screenSecretChat = document.getElementById('screen-secret-chat');

const userArea = document.getElementById('user-area');
const menuTabs = document.getElementById('menu-tabs');
const userNameEl = document.getElementById('user-name');
const chatTimeline = document.getElementById('chat-timeline');
const commentInput = document.getElementById('chat-input-comment');
const tabMain = document.getElementById('tab-main');
const tabCal = document.getElementById('tab-cal');
const tabSecretChat = document.getElementById('tab-secret-chat');

const memberNameInput = document.getElementById('input-member-name');
const memberNameCounter = document.getElementById('member-name-counter');
const chatCommentCounter = document.getElementById('chat-comment-counter');

if (memberNameInput && memberNameCounter) {
  memberNameInput.addEventListener('input', () => {
    const len = memberNameInput.value.length;
    memberNameCounter.textContent = `${len} / 15文字`;
    if (len > 15) {
      memberNameCounter.className = "text-[9px] text-rose-400 font-bold animate-pulse";
    } else {
      memberNameCounter.className = "text-[9px] text-slate-400 font-semibold";
    }
  });
}

if (commentInput && chatCommentCounter) {
  commentInput.addEventListener('input', () => {
    const len = commentInput.value.length;
    chatCommentCounter.textContent = `${len} / 15`;
    if (len > 15) {
      chatCommentCounter.className = "absolute right-2 top-1/2 transform -translate-y-1/2 text-[8px] text-rose-400 font-bold bg-slate-950/80 px-1 py-0.5 rounded animate-pulse";
    } else {
      chatCommentCounter.className = "absolute right-2 top-1/2 transform -translate-y-1/2 text-[8px] text-slate-500 font-semibold bg-slate-950/80 px-1 py-0.5 rounded";
    }
  });
}

function startRealtimeSync() {
  db.collection("activities").orderBy("date", "asc").onSnapshot((snapshot) => {
    activities = [];
    snapshot.forEach((doc) => {
      activities.push({ docId: doc.id, ...doc.data() });
    });

    if (currentUser.role === 'leader' && screenLeader && !screenLeader.classList.contains('hidden')) {
      renderLeaderScreen();
    }
    if (screenCalendar && !screenCalendar.classList.contains('hidden')) {
      renderCalendar(currentDisplayYear, currentDisplayMonth);
    }
  }, (error) => {
    console.error("DB同期エラー:", error);
  });

  initLeaderChatSync();
}

startRealtimeSync();

function showScreen(type) {
  [
    screenLogin,
    screenMember,
    screenCalendar,
    screenLeader,
    screenSecretChat,
    userArea,
    menuTabs
  ].forEach(el => {
    if (el) el.classList.add('hidden');
  });

  if (type === 'login') {
    if (screenLogin) screenLogin.classList.remove('hidden');
  } else {
    if (userArea) userArea.classList.remove('hidden');
    if (menuTabs) menuTabs.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = `User: ${currentUser.name}`;
    if (tabMain) tabMain.textContent = (currentUser.role === 'leader') ? "集計" : "回答";

    // リーダーの場合のみ秘密チャットタブを表示
    if (tabSecretChat) {
      if (currentUser.role === 'leader') {
        tabSecretChat.classList.remove('hidden');
      } else {
        tabSecretChat.classList.add('hidden');
      }
    }

    // 各タブの共通スタイルリセット
    [tabMain, tabCal, tabSecretChat].forEach(tab => {
      if (tab) {
        const isHidden = tab.classList.contains('hidden');
        tab.className = "text-[11px] bg-slate-700 px-2.5 py-1.5 rounded-lg font-bold hover:bg-slate-600 transition text-slate-300";
        if (isHidden) tab.classList.add('hidden');
      }
    });

    if (type === 'member') {
      if (screenMember) screenMember.classList.remove('hidden');
      setTabActive(tabMain);
    } else if (type === 'leader') {
      if (screenLeader) screenLeader.classList.remove('hidden');
      setTabActive(tabMain);
      renderLeaderScreen();
    } else if (type === 'calendar') {
      if (screenCalendar) screenCalendar.classList.remove('hidden');
      setTabActive(tabCal);
      renderCalendar(currentDisplayYear, currentDisplayMonth);
    } else if (type === 'secret-chat') {
      if (screenSecretChat) screenSecretChat.classList.remove('hidden');
      setTabActive(tabSecretChat);
      const tl = document.getElementById('secret-chat-timeline');
      if (tl) tl.scrollTop = tl.scrollHeight;
    }
  }
}

function setTabActive(activeTab) {
  if (activeTab) {
    activeTab.classList.remove("bg-slate-700", "text-slate-300", "hover:bg-slate-600");
    activeTab.classList.add("bg-cyan-600", "text-white", "shadow-lg");
  }
}

window.switchTab = (name) => showScreen(name);
window.clickMainTab = () => showScreen(currentUser.role === 'leader' ? 'leader' : 'member');

const loginMemberBtn = document.getElementById('login-member');
if (loginMemberBtn) {
  loginMemberBtn.addEventListener('click', () => {
    const inputEl = document.getElementById('input-member-name');
    const name = inputEl ? inputEl.value.trim() : "";
    
    if (!name) {
      return showNotification('お名前を入力してください！', 'warning');
    }

    if (name.length > 15) {
      return showNotification('ユーザー名は15文字以内で入力してください！', 'error');
    }

    currentUser = { name: name, role: 'member' };
    showScreen('member');
    initLatestActivityBot();
  });
}

const loginLeaderBtn = document.getElementById('login-leader');
if (loginLeaderBtn) {
  loginLeaderBtn.addEventListener('click', () => {
    const passEl = document.getElementById('input-leader-pass');

    if (passEl && passEl.value === 'yamairi') {
      currentUser = {
        name: '部長・顧問',
        role: 'leader'
      };
      showScreen('leader');
    } else {
      showNotification('パスワードが間違っています。', 'error');
    }
  });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    currentUser = { name: '', role: '' };
    const memberInput = document.getElementById('input-member-name');
    const leaderInput = document.getElementById('input-leader-pass');
    if (memberInput) memberInput.value = '';
    if (leaderInput) leaderInput.value = '';
    if (memberNameCounter) memberNameCounter.textContent = '0 / 15文字';
    showScreen('login');
  });
}

function initLatestActivityBot() {
  if (!chatTimeline) return;
  chatTimeline.innerHTML = ''; 
  addBotMessage(`接続IP: ${myPseudoIP} (セキュア接続完了)`);

  if (activities.length === 0) {
    addBotMessage("現在、案内できる部活の予定が登録されていません。部長の登録をお待ちください。");
    selectedActivityDocId = '';
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingActivities = activities.filter(act => act.date >= todayStr);

  if (upcomingActivities.length > 0) {
    selectedActivityDocId = upcomingActivities[0].docId;
  } else {
    selectedActivityDocId = activities[activities.length - 1].docId;
  }

  addBotMessage("こんにちは！画面下のメニューから「活動日」を選んで、出欠ボタンを押してください。");
  renderFixedActivitySelect();
  showCurrentStatusMessage();
}

function renderFixedActivitySelect() {
  const container = document.getElementById('fixed-activity-select-container');
  if (!container) return;

  let selectOptions = activities.map(act => {
    const isSelected = act.docId === selectedActivityDocId ? 'selected' : '';
    return `<option value="${act.docId}" ${isSelected}>📅 ${act.date} (@${act.location})</option>`;
  }).join('');

  container.innerHTML = `
    <select id="bot-activity-select" onchange="changeSelectedActivity(this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-cyan-400 font-bold focus:outline-none focus:border-cyan-500 shadow-inner">
      ${selectOptions}
    </select>
  `;
}

window.changeSelectedActivity = function(docId) {
  selectedActivityDocId = docId;
  const target = activities.find(a => a.docId === docId);
  if (target) {
    addUserMessage(`「${target.date}」の予定を確認`);
    showCurrentStatusMessage();
  }
};

function showCurrentStatusMessage() {
  const currentAct = activities.find(a => a.docId === selectedActivityDocId);
  if (!currentAct) return;

  let msg = `【現在の選択】\n📅 日付: ${currentAct.date}\n📍 場所: ${currentAct.location}\n\n`;
  
  if (currentAct.attendance && currentAct.attendance[currentUser.name]) {
    msg += `👉 あなたは現在「${currentAct.attendance[currentUser.name].status}」で登録されています。変更する場合はボタンを押し直してください！`;
  } else {
    msg += `👉 まだこの日の出欠回答がありません。ボタンを押して回答してください。`;
  }
  
  setTimeout(() => {
    addBotMessage(msg);
  }, 200);
}

window.instantUpdate = function(status) {
  const currentAct = activities.find(a => a.docId === selectedActivityDocId);
  if (!currentAct) {
    showNotification('活動予定が選択されていないか、登録がありません。', 'warning');
    return;
  }
  
  if (!currentAct.attendance) currentAct.attendance = {};

  const findExistingIpUser = Object.entries(currentAct.attendance).find(([name, user]) => user.ip === myPseudoIP && name !== currentUser.name);
  if (findExistingIpUser) {
    const registeredName = findExistingIpUser[0];
    showNotification(`すでにこの端末から「${registeredName}」として送信されています。`, 'error');
    return; 
  }

  const updatedAttendance = { ...currentAct.attendance };
  updatedAttendance[currentUser.name] = { 
    status: status, 
    comment: currentAct.attendance[currentUser.name]?.comment || "",
    ip: myPseudoIP
  };

  db.collection("activities").doc(currentAct.docId).update({
    attendance: updatedAttendance
  }).then(() => {
    addUserMessage(`「${status}」に変更しました！`);
    setTimeout(() => {
      addBotMessage(`了解です！${currentUser.name}さんの ${currentAct.date} 分のステータスを「${status}」に更新しました✅`);
    }, 200);
  }).catch(err => showNotification("DB更新に失敗しました: " + err, "error"));
};

window.sendAdditionalComment = function() {
  if (!commentInput) return;
  const comment = commentInput.value.trim();
  const currentAct = activities.find(a => a.docId === selectedActivityDocId);
  
  if (!currentAct || !currentAct.attendance || !currentAct.attendance[currentUser.name]) {
    showNotification('先に上のボタンで出席・欠席・遅刻を選んでください。', 'warning');
    return;
  }

  if (comment.length > 15) {
    return showNotification('コメントは15文字以内で入力してください！', 'error');
  }

  const updatedAttendance = { ...currentAct.attendance };
  updatedAttendance[currentUser.name].comment = comment;

  db.collection("activities").doc(currentAct.docId).update({
    attendance: updatedAttendance
  }).then(() => {
    addUserMessage(comment || "(メッセージなしで送信)");
    setTimeout(() => {
      addBotMessage(`${currentAct.date}の予定に、コメントを保存しました👍`);
    }, 200);
    commentInput.value = '';
    if (chatCommentCounter) chatCommentCounter.textContent = '0 / 15';
  }).catch(err => showNotification("コメントのDB保存に失敗しました: " + err, "error"));
};

function addBotMessage(text) {
  if (!chatTimeline) return;
  const div = document.createElement('div');
  div.className = 'flex items-start gap-2 animate-in';
  div.innerHTML = `
    <div class="w-7 h-7 rounded-full bg-cyan-700 flex-shrink-0 flex items-center justify-center text-[10px]">bot</div>
    <div class="bg-slate-800 p-3 chat-bubble bot-bubble max-w-[80%] text-slate-200 border border-slate-700 shadow-sm whitespace-pre-wrap">${text}</div>
  `;
  chatTimeline.appendChild(div);
  chatTimeline.scrollTop = chatTimeline.scrollHeight;
}

function addUserMessage(text) {
  if (!chatTimeline) return;
  const div = document.createElement('div');
  div.className = 'flex justify-end animate-in';
  div.innerHTML = `
    <div class="bg-cyan-600 p-3 chat-bubble user-bubble max-w-[80%] text-white shadow-md">${text}</div>
  `;
  chatTimeline.appendChild(div);
  chatTimeline.scrollTop = chatTimeline.scrollHeight;
}

const btnAddSchedule = document.getElementById('btn-add-schedule');
if (btnAddSchedule) {
  btnAddSchedule.addEventListener('click', () => {
    const dateEl = document.getElementById('schedule-date');
    const locEl = document.getElementById('schedule-location');
    const date = dateEl ? dateEl.value : "";
    const loc = locEl ? locEl.value.trim() : "";

    if (!date || !loc) return showNotification('日付と場所を入力してね！', 'warning');

    const newSchedule = {
      id: Date.now(), 
      date: date, 
      location: loc, 
      attendance: {} 
    };

    db.collection("activities").add(newSchedule)
      .then(() => {
        showNotification(`クラウドDBに予定を追加しました！`, 'success');
        if (dateEl) dateEl.value = '';
        if (locEl) locEl.value = '';
      })
      .catch(err => showNotification("スケジュール登録エラー: " + err, 'error'));
  });
}

window.deleteSchedule = function(docId) {
  if (!confirm('この活動予定を完全に削除してもよろしいですか？')) return;

  db.collection("activities").doc(docId).delete()
    .then(() => {
      showNotification("予定を削除しました。", "success");
    })
    .catch(err => showNotification("削除エラー: " + err, "error"));
};

function renderCalendar(year, month) {
  const label = document.getElementById('calendar-month-year');
  if (label) label.textContent = `${year}年${month}月`;

  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const detailBox = document.getElementById('calendar-detail');
  if (detailBox) detailBox.classList.add('hidden');

  const first = new Date(year, month - 1, 1).getDay();
  const last = new Date(year, month, 0).getDate();

  for (let i = 0; i < first; i++) grid.appendChild(document.createElement('div'));

  for (let day = 1; day <= last; day++) {
    const btn = document.createElement('button');
    btn.className = 'p-1 bg-slate-800/40 hover:bg-slate-700 text-[11px] rounded-lg h-10 border border-slate-800 flex flex-col items-center justify-center relative';
    btn.innerHTML = `<span>${day}</span>`;

    const fDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const act = activities.find(a => a.date === fDate);

    if (act) {
      btn.innerHTML += `<span class="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-0.5 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></span>`;
      btn.onclick = () => {
        if (detailBox) detailBox.classList.remove('hidden');
        const detailDateEl = document.getElementById('detail-date');
        const detailInfoEl = document.getElementById('detail-info');
        if (detailDateEl) detailDateEl.textContent = `${year}年${month}月${day}日`;
        if (detailInfoEl) detailInfoEl.textContent = `場所・内容: ${act.location}`;
      };
    }
    grid.appendChild(btn);
  }
}

window.changeMonth = function(offset) {
  currentDisplayMonth += offset;
  if (currentDisplayMonth > 12) {
    currentDisplayMonth = 1;
    currentDisplayYear += 1;
  } else if (currentDisplayMonth < 1) {
    currentDisplayMonth = 12;
    currentDisplayYear -= 1;
  }
  renderCalendar(currentDisplayYear, currentDisplayMonth);
};

function renderLeaderScreen() {
  const container = document.getElementById('leader-summary');
  if (!container) return;
  container.innerHTML = '';

  activities.forEach(act => {
    const list = Object.entries(act.attendance || {});
    let counts = { '出席': 0, '欠席': 0, '遅刻': 0 };
    list.forEach(([_, i]) => {
      if (counts[i.status] !== undefined) counts[i.status]++;
    });

    const statusOrder = { '出席': 1, '遅刻': 2, '欠席': 3 };
    list.sort((a, b) => (statusOrder[a[1].status] || 99) - (statusOrder[b[1].status] || 99));

    let rows = list.map(([name, info]) => `
      <div class="py-2 border-b border-slate-800 last:border-0">
        <div class="flex justify-between items-center text-xs">
          <span class="font-bold text-slate-200">${name} <span class="text-[9px] text-slate-600 font-mono">(${info.ip || '192.168.10.xx'})</span></span>
          <span class="font-black ${info.status==='出席'?'text-emerald-400':info.status==='欠席'?'text-rose-400':'text-amber-400'}">${info.status}</span>
        </div>
        <p class="text-[10px] text-slate-500 mt-0.5">💬 ${info.comment || '（コメントなし）'}</p>
      </div>
    `).join('');

    const card = document.createElement('div');
    card.className = 'bg-slate-900/60 p-4 rounded-xl border border-slate-800 shadow-inner space-y-3 mb-4';
    card.innerHTML = `
      <div class="flex justify-between items-start border-b border-slate-800 pb-2">
        <div>
          <p class="text-xs font-bold text-amber-500">${act.date}</p>
          <p class="text-[10px] text-slate-400">@ ${act.location}</p>
        </div>
        <div class="flex flex-col items-end gap-1.5">
          <div class="flex gap-1 text-[9px] font-mono">
            <span class="bg-emerald-500/10 text-emerald-400 px-1 rounded">出:${counts['出席']}</span>
            <span class="bg-rose-500/10 text-rose-400 px-1 rounded">欠:${counts['欠席']}</span>
            <span class="bg-amber-500/10 text-amber-400 px-1 rounded">遅:${counts['遅刻']}</span>
          </div>
          <button onclick="deleteSchedule('${act.docId}')" class="text-[10px] bg-rose-950/40 hover:bg-rose-900 text-rose-400 px-2 py-0.5 rounded border border-rose-900/50 transition">
            <i class="fa-solid fa-trash-can mr-1"></i>削除
          </button>
        </div>
      </div>
      <div>${rows || '<p class="text-[10px] text-slate-600 text-center py-2">まだ回答がありません</p>'}</div>
    `;
    container.appendChild(card);
  });
}

function initLeaderChatSync() {
  const secretChatTimeline = document.getElementById('secret-chat-timeline');
  const secretChatInput = document.getElementById('secret-chat-input');
  const sendSecretBtn = document.getElementById('btn-send-secret-chat');

  if (!secretChatTimeline) return;

  db.collection("leader_chats").orderBy("createdAt", "asc").onSnapshot(snapshot => {
    secretChatTimeline.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      
      const isMe = data.senderIp === myPseudoIP;
      
      const messageWrapper = document.createElement('div');
      messageWrapper.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in w-full mb-3`;
      
      let timeStr = "";
      if (data.createdAt) {
        const d = data.createdAt.toDate();
        timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }

      const bubbleClass = isMe 
        ? 'bg-amber-500 text-slate-900 font-bold rounded-l-xl rounded-tr-xl' 
        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-r-xl rounded-tl-xl';

      const displayName = isMe ? 'あなた' : (data.senderName || '他の部員');

      messageWrapper.innerHTML = `
        <span class="text-[9px] text-slate-500 mb-0.5 px-1">${displayName}</span>
        <div class="flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} w-full">
          <div class="p-2.5 shadow-md max-w-[75%] text-xs ${bubbleClass}">
            ${data.text}
          </div>
          <span class="text-[8px] text-slate-600 font-mono select-none">${timeStr}</span>
        </div>
      `;
      secretChatTimeline.appendChild(messageWrapper);
    });
    secretChatTimeline.scrollTop = secretChatTimeline.scrollHeight;
  });

  const sendMessage = () => {
    if (!secretChatInput) return;
    const text = secretChatInput.value.trim();
    if (!text) return;

    db.collection("leader_chats").add({
      senderName: currentUser.name, 
      senderIp: myPseudoIP,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      secretChatInput.value = "";
    }).catch(err => console.error("チャット送信エラー: ", err));
  };

  if (sendSecretBtn) sendSecretBtn.onclick = sendMessage;
  if (secretChatInput) {
    secretChatInput.onkeydown = (e) => { 
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(); 
      }
    };
  }
}

showScreen('login');