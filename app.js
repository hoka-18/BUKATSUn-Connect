// --- 1. Firebase初期化設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyCW7Epy6bM_k4KhGvqnFNXkcLyp7xRqmO4",
  authDomain: "bukatsun-connect.firebaseapp.com",
  projectId: "bukatsun-connect",
  storageBucket: "bukatsun-connect.firebasestorage.app",
  messagingSenderId: "283549888321",
  appId: "1:283549888321:web:8339b7c00128dec49cfbc0",
  measurementId: "G-WDVC4CTGK4"
};

// Firebaseの初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 2. グローバル状態管理 ＆ 端末固有設定 ---
let currentUser = { name: '', role: '' };
let activities = []; 
let selectedActivityDocId = ''; 

// カレンダー表示用の状態管理
const currentDisplayDate = new Date();
let currentDisplayYear = currentDisplayDate.getFullYear();
let currentDisplayMonth = currentDisplayDate.getMonth() + 1;

// 端末ごとにオリジナルの擬似IPアドレスを自動生成してブラウザに記憶
let myPseudoIP = localStorage.getItem('BUKATSUn_MY_IP');
if (!myPseudoIP) {
  myPseudoIP = `192.168.10.${Math.floor(Math.random() * 254) + 1}`;
  localStorage.setItem('BUKATSUn_MY_IP', myPseudoIP);
}

const screenLogin = document.getElementById('screen-login');
const screenMember = document.getElementById('screen-member');
const screenCalendar = document.getElementById('screen-calendar');
const screenLeader = document.getElementById('screen-leader');
const screenChat = document.getElementById('screen-chat'); // チャット画面エリア
const userArea = document.getElementById('user-area');
const menuTabs = document.getElementById('menu-tabs');
const userNameEl = document.getElementById('user-name');
const chatTimeline = document.getElementById('chat-timeline');
const commentInput = document.getElementById('chat-input-comment');
const tabMain = document.getElementById('tab-main');
const tabCal = document.getElementById('tab-cal');
const tabChat = document.getElementById('tab-chat'); // チャットタブボタン

// --- 3. データベース（DB）リアルタイム同期リスナー ---
function startRealtimeSync() {
  // ① 部活動予定データのリアルタイム同期
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

  // ② 顧問・部長チャットのリアルタイム同期
  initLeaderChatSync();
}

// アプリ立ち上げ時に同期を開始
startRealtimeSync();

// --- 4. 画面切り替え制御（部員のチャット非表示対応版） ---
function showScreen(type) {
  // すべての画面を一旦隠す
  [screenLogin, screenMember, screenCalendar, screenLeader, screenChat, userArea, menuTabs].forEach(el => {
    if (el) el.classList.add('hidden');
  });

  if (type === 'login') {
    if (screenLogin) screenLogin.classList.remove('hidden');
  } else {
    if (userArea) userArea.classList.remove('hidden');
    if (menuTabs) menuTabs.classList.remove('hidden');
    userNameEl.textContent = `User: ${currentUser.name}`;
    tabMain.textContent = (currentUser.role === 'leader') ? "集計" : "回答";

    // ⭐【ここを修正】ログインしているのが「リーダー」の時だけチャットタブを表示する
    if (tabChat) {
      if (currentUser.role === 'leader') {
        tabChat.classList.remove('hidden'); // 管理者ならタブを出す
      } else {
        tabChat.classList.add('hidden');    // 一般部員ならタブを完全に隠す
      }
    }

    // タブのアクティブ状態スタイルをリセット
    [tabMain, tabCal, tabChat].forEach(tab => {
      if (tab) {
        // 既存のスタイルをベースにリセット（hidden属性は上書きしないよう調整）
        const isHidden = tab.classList.contains('hidden');
        tab.className = "text-xs bg-slate-800 px-3 py-1.5 rounded font-bold text-slate-400 hover:bg-slate-700";
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
    } else if (type === 'chat') {
      // 安全対策：もし部員が不正にチャット画面を開こうとしたらメイン画面に戻す
      if (currentUser.role !== 'leader') {
        showScreen('member');
        return;
      }
      if (screenChat) screenChat.classList.remove('hidden');
      setTabActive(tabChat);
      const tl = document.getElementById('leader-chat-timeline');
      if (tl) tl.scrollTop = tl.scrollHeight;
    }
  }
}

function setTabActive(activeTab) {
  if (activeTab) {
    activeTab.classList.remove("bg-slate-800", "text-slate-400", "hover:bg-slate-700");
    activeTab.classList.add("bg-cyan-600", "text-white", "shadow-lg", "shadow-cyan-900/20");
  }
}

window.switchTab = (name) => showScreen(name);
window.clickMainTab = () => showScreen(currentUser.role === 'leader' ? 'leader' : 'member');

// --- 5. ログイン・ログアウト ---
document.getElementById('login-member').addEventListener('click', () => {
  const name = document.getElementById('input-member-name').value.trim();
  if (!name) return alert('名前を入力してね');

  currentUser = { name: name, role: 'member' };
  showScreen('member');
  initLatestActivityBot();
});

document.getElementById('login-leader').addEventListener('click', () => {
  if (document.getElementById('input-leader-pass').value === 'yamairi') {
    currentUser = { name: '部長・顧問', role: 'leader' };
    showScreen('leader');
  } else {
    alert('パスワードが違います');
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  currentUser = { name: '', role: '' };
  document.getElementById('input-member-name').value = '';
  document.getElementById('input-leader-pass').value = '';
  showScreen('login');
});

// --- 6. 出欠回答機能（下部固定プルダウン版） ---
function initLatestActivityBot() {
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
    <select id="bot-activity-select" onchange="changeSelectedActivity(this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-500 shadow-inner">
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
    alert('活動予定が選択されていないか、登録がありません。');
    return;
  }
  
  if (!currentAct.attendance) currentAct.attendance = {};

  const findExistingIpUser = Object.entries(currentAct.attendance).find(([name, user]) => user.ip === myPseudoIP && name !== currentUser.name);
  if (findExistingIpUser) {
    const registeredName = findExistingIpUser[0];
    alert(`【セキュリティエラー】この端末（IP: ${myPseudoIP}）からは、すでに「${registeredName}」として出欠が送信されています。\nシステムによってブロックされます。`);
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
  }).catch(err => alert("DB更新に失敗しました: " + err));
};

window.sendAdditionalComment = function() {
  const comment = commentInput.value.trim();
  const currentAct = activities.find(a => a.docId === selectedActivityDocId);
  
  if (!currentAct || !currentAct.attendance || !currentAct.attendance[currentUser.name]) {
    alert('先に上のボタンで出席・欠席・遅刻のどれかを選んでね！');
    return;
  }

  const updatedAttendance = { ...currentAct.attendance };
  updatedAttendance[currentUser.name].comment = comment;

  db.collection("activities").doc(currentAct.docId).update({
    attendance: updatedAttendance
  }).then(() => {
    addUserMessage(comment || "(メッセージなしで送信)");
    setTimeout(() => {
      addBotMessage(`${currentAct.date}の予定に、コメント「${comment || 'なし'}」を保存しました👍`);
    }, 200);
    commentInput.value = '';
  }).catch(err => alert("コメントのDB保存に失敗しました: " + err));
};

function addBotMessage(text) {
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
  const div = document.createElement('div');
  div.className = 'flex justify-end animate-in';
  div.innerHTML = `
    <div class="bg-cyan-600 p-3 chat-bubble user-bubble max-w-[80%] text-white shadow-md">${text}</div>
  `;
  chatTimeline.appendChild(div);
  chatTimeline.scrollTop = chatTimeline.scrollHeight;
}

// --- 7. 部長用：スケジュール登録 ＆ 削除機能（DB接続版） ---
if (document.getElementById('btn-add-schedule')) {
  document.getElementById('btn-add-schedule').addEventListener('click', () => {
    const date = document.getElementById('schedule-date').value;
    const loc = document.getElementById('schedule-location').value.trim();
    if (!date || !loc) return alert('日付と場所を入力してね！');

    const newSchedule = {
      id: Date.now(), 
      date: date, 
      location: loc, 
      attendance: {} 
    };

    db.collection("activities").add(newSchedule)
      .then(() => {
        alert(`クラウドDBに「${date}：${loc}」を追加しました！`);
        document.getElementById('schedule-date').value = '';
        document.getElementById('schedule-location').value = '';
      })
      .catch(err => alert("スケジュール登録エラー: " + err));
  });
}

window.deleteSchedule = function(docId) {
  if (!confirm('この活動予定（および部員の回答データ）を完全に削除してもよろしいですか？')) return;

  db.collection("activities").doc(docId).delete()
    .then(() => {
      alert("データを削除しました。");
    })
    .catch(err => alert("削除エラー: " + err));
};

// --- 8. カレンダー描画 ---
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
        document.getElementById('detail-date').textContent = `${year}年${month}月${day}日`;
        document.getElementById('detail-info').textContent = `場所・内容: ${act.location}`;
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

// --- 9. 集計画面描画（部員の回答ソート版） ---
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

// --- 10. 顧問・部長チャットルーム：左右振り分け ＆ リアルタイム同期 ---
function initLeaderChatSync() {
  const leaderChatTimeline = document.getElementById('leader-chat-timeline');
  const leaderChatInput = document.getElementById('leader-chat-input');
  const sendLeaderBtn = document.getElementById('btn-send-leader-message');

  if (!leaderChatTimeline) return;

  // 💬 クラウド上のチャットメッセージ（leader_chats）を監視して描画
  db.collection("leader_chats").orderBy("createdAt", "asc").onSnapshot(snapshot => {
    leaderChatTimeline.innerHTML = "";
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

      messageWrapper.innerHTML = `
        <span class="text-[9px] text-slate-500 mb-0.5 px-1">${isMe ? 'あなた' : '他のリーダー'}</span>
        <div class="flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} w-full">
          <div class="p-2.5 shadow-md max-w-[75%] text-xs ${bubbleClass}">
            ${data.text}
          </div>
          <span class="text-[8px] text-slate-600 font-mono select-none">${timeStr}</span>
        </div>
      `;
      leaderChatTimeline.appendChild(messageWrapper);
    });
    leaderChatTimeline.scrollTop = leaderChatTimeline.scrollHeight;
  });

  // 🚀 チャット送信
  const sendMessage = () => {
    if (!leaderChatInput) return;
    const text = leaderChatInput.value.trim();
    if (!text) return;

    db.collection("leader_chats").add({
      senderName: currentUser.name,
      senderIp: myPseudoIP,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      leaderChatInput.value = "";
    }).catch(err => console.error("チャット送信エラー: ", err));
  };

  // 送信イベントの定義
  if (sendLeaderBtn) sendLeaderBtn.onclick = sendMessage;
  if (leaderChatInput) {
    leaderChatInput.onkeydown = (e) => { 
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(); 
      }
    };
  }
}

// 起動時にログイン画面を表示
showScreen('login');