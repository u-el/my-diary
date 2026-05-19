/* ══════════════════════════════════════
   Firebase 초기화
══════════════════════════════════════ */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

let currentUser = null; // 로그인한 사용자 정보

/* ══════════════════════════════════════
   상수
══════════════════════════════════════ */
const MOODS = [
  { key: 'joy',     emoji: '😄', label: '기쁨' },
  { key: 'smile',   emoji: '😊', label: '미소' },
  { key: 'excited', emoji: '🥰', label: '설렘' },
  { key: 'soso',    emoji: '😐', label: 'soso' },
  { key: 'tired',   emoji: '😴', label: '피곤' },
  { key: 'anxious', emoji: '😰', label: '불안' },
  { key: 'sad',     emoji: '😢', label: '우울' },
  { key: 'annoyed', emoji: '😤', label: '짜증' },
  { key: 'angry',   emoji: '😡', label: '화남' },
];

const WEATHERS = [
  { key: 'sunny',  emoji: '☀️',  label: '맑음' },
  { key: 'cloudy', emoji: '⛅',  label: '구름' },
  { key: 'rainy',  emoji: '🌧️', label: '비'   },
  { key: 'snowy',  emoji: '❄️',  label: '눈'   },
  { key: 'foggy',  emoji: '🌫️', label: '흐림' },
];

let currentDetailId    = null;
let currentSearchQuery = '';
let currentFilterStarred = false;
let currentTags        = []; // 작성 중인 태그 배열
let currentCalYear     = new Date().getFullYear();
let currentCalMonth    = new Date().getMonth();
let currentStatYear    = new Date().getFullYear();
let currentStatMonth   = new Date().getMonth();

/* ══════════════════════════════════════
   인증 — 로그인 / 로그아웃
══════════════════════════════════════ */
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    alert('로그인 중 문제가 생겼어요: ' + err.message);
  });
}

function signOutUser() {
  if (!confirm('로그아웃 할까요?')) return;
  auth.signOut();
}

// 로그인 상태가 바뀔 때마다 자동으로 실행돼요
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    // ── 로그인 됐을 때 ──
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('app-body').style.display   = '';

    // 헤더에 프로필 표시
    const photo = document.getElementById('user-photo');
    if (user.photoURL) {
      photo.src = user.photoURL;
      photo.style.display = '';
    } else {
      photo.style.display = 'none';
    }
    document.getElementById('user-name').textContent = user.displayName || user.email;

    showList();
  } else {
    // ── 로그아웃 됐을 때 ──
    document.getElementById('view-login').style.display = '';
    document.getElementById('app-body').style.display   = 'none';
  }
});

/* ══════════════════════════════════════
   Firestore — 읽기 / 쓰기 / 삭제
══════════════════════════════════════ */
function entriesRef() {
  // 내 일기만 저장되는 경로: users/내UID/entries/
  return db.collection('users').doc(currentUser.uid).collection('entries');
}

async function loadEntries() {
  const snapshot = await entriesRef().orderBy('date', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/* ══════════════════════════════════════
   기분 선택
══════════════════════════════════════ */
function renderMoodSelector() {
  const container = document.getElementById('mood-selector');
  container.innerHTML = MOODS.map(m => `
    <button type="button" class="mood-btn" data-key="${m.key}"
      onclick="selectMood('${m.key}')" title="${m.label}">
      <span class="mood-emoji">${m.emoji}</span>
      <span class="mood-label">${m.label}</span>
    </button>
  `).join('');
}

function selectMood(key) {
  document.getElementById('entry-mood').value = key;
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === key);
  });
}

/* ══════════════════════════════════════
   날씨 선택
══════════════════════════════════════ */
function renderWeatherSelector() {
  const container = document.getElementById('weather-selector');
  container.innerHTML = WEATHERS.map(w => `
    <button type="button" class="weather-btn" data-key="${w.key}"
      onclick="selectWeather('${w.key}')" title="${w.label}">
      <span class="weather-emoji">${w.emoji}</span>
      <span class="weather-label">${w.label}</span>
    </button>
  `).join('');
}

function selectWeather(key) {
  document.getElementById('entry-weather').value = key;
  document.querySelectorAll('.weather-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.key === key);
  });
}

/* ══════════════════════════════════════
   태그
══════════════════════════════════════ */
const MAX_TAGS = 5;

function handleTagKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); addTag(); }
}

function addTag() {
  const input = document.getElementById('tag-input');
  const val   = input.value.trim().replace(/\s+/g, ' ');
  if (!val) return;

  if (currentTags.length >= MAX_TAGS) {
    showTagLimitMsg(); return;
  }
  if (currentTags.includes(val)) {
    input.value = ''; return; // 중복 무시
  }

  currentTags.push(val);
  input.value = '';
  renderTagChips();
}

function removeTag(idx) {
  currentTags.splice(idx, 1);
  renderTagChips();
}

function renderTagChips() {
  const container = document.getElementById('tag-chips');
  const input     = document.getElementById('tag-input');
  const limitMsg  = document.getElementById('tag-limit-msg');
  const isFull    = currentTags.length >= MAX_TAGS;

  container.innerHTML = currentTags.map((t, i) => `
    <span class="tag-chip">
      #${escapeHtml(t)}
      <button type="button" class="tag-chip-remove" onclick="removeTag(${i})">×</button>
    </span>
  `).join('');

  input.disabled       = isFull;
  input.placeholder    = isFull ? '태그가 꽉 찼어요 (최대 5개)' : '태그 입력 후 Enter 또는 + 버튼';
  limitMsg.style.display = 'none';
}

function showTagLimitMsg() {
  const msg = document.getElementById('tag-limit-msg');
  msg.style.display = '';
  setTimeout(() => { msg.style.display = 'none'; }, 2000);
}

/* ══════════════════════════════════════
   즐겨찾기
══════════════════════════════════════ */
async function toggleStar() {
  if (!currentDetailId) return;
  const doc  = await entriesRef().doc(currentDetailId).get();
  if (!doc.exists) return;
  const starred = !doc.data().starred;
  await entriesRef().doc(currentDetailId).update({ starred });
  // 버튼 즉시 갱신
  const btn = document.getElementById('detail-star-btn');
  btn.textContent = starred ? '⭐' : '☆';
  btn.classList.toggle('starred', starred);
}

function toggleStarFilter() {
  currentFilterStarred = !currentFilterStarred;
  const btn = document.getElementById('btn-star-filter');
  btn.textContent = currentFilterStarred ? '⭐' : '☆';
  btn.classList.toggle('active', currentFilterStarred);
  renderList(currentSearchQuery);
}

/* ══════════════════════════════════════
   탭 전환
══════════════════════════════════════ */
function switchTab(tab) {
  ['list','calendar','stats'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display      = t === tab ? '' : 'none';
    document.getElementById(`tab-btn-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'calendar') renderCalendar();
  if (tab === 'stats')    renderStats();
}

/* ══════════════════════════════════════
   캘린더
══════════════════════════════════════ */
async function renderCalendar() {
  document.getElementById('cal-body').innerHTML =
    '<div class="cal-loading" style="grid-column:1/-1;text-align:center;padding:20px;color:#b08090;">불러오는 중...</div>';

  const entries = await loadEntries();
  const entryMap = {};
  entries.forEach(e => { if (!entryMap[e.date]) entryMap[e.date] = e; });

  const today = new Date().toISOString().slice(0, 10);
  const year  = currentCalYear;
  const month = currentCalMonth;

  document.getElementById('cal-title').textContent = `${year}년 ${month + 1}월`;

  const firstDay    = new Date(year, month, 1).getDay();
  const lastDate    = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();

  let cells = '';

  for (let i = firstDay - 1; i >= 0; i--) {
    cells += `<div class="cal-day other-month"><span class="cal-day-num">${prevLastDate - i}</span></div>`;
  }

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const entry   = entryMap[dateStr];
    const isToday = dateStr === today;

    let emoji = '';
    if (entry) {
      const m = MOODS.find(x => x.key === entry.mood);
      const w = WEATHERS.find(x => x.key === entry.weather);
      emoji = `<div class="cal-day-emoji">${m ? m.emoji : ''}${w ? w.emoji : ''}</div>`;
    }

    const classes = ['cal-day', entry ? 'has-entry' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    const onclick = entry
      ? `showDetailFromCal('${entry.id}')`
      : `showWriteFromCal('${dateStr}')`;

    cells += `<div class="${classes}" onclick="${onclick}">
      <span class="cal-day-num">${d}</span>${emoji}
    </div>`;
  }

  const total     = firstDay + lastDate;
  const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remainder; d++) {
    cells += `<div class="cal-day other-month"><span class="cal-day-num">${d}</span></div>`;
  }

  document.getElementById('cal-body').innerHTML = cells;
}

function prevMonth() {
  if (currentCalMonth === 0) { currentCalMonth = 11; currentCalYear--; }
  else currentCalMonth--;
  renderCalendar();
}

function nextMonth() {
  if (currentCalMonth === 11) { currentCalMonth = 0; currentCalYear++; }
  else currentCalMonth++;
  renderCalendar();
}

/* ══════════════════════════════════════
   기분 통계
══════════════════════════════════════ */
async function renderStats() {
  const body = document.getElementById('stats-body');
  body.innerHTML = '<p style="text-align:center;color:#b08090;padding:32px 0;">불러오는 중...</p>';

  document.getElementById('stats-title').textContent =
    `${currentStatYear}년 ${currentStatMonth + 1}월`;

  const all     = await loadEntries();
  const ym      = `${currentStatYear}-${String(currentStatMonth + 1).padStart(2,'0')}`;
  const entries = all.filter(e => e.date.startsWith(ym));
  const total   = entries.length;

  if (total === 0) {
    body.innerHTML = `<p class="empty-msg" style="display:block;">이 달에 쓴 일기가 없어요 🌸</p>`;
    return;
  }

  // 기분 집계
  const moodCount = {};
  entries.forEach(e => { if (e.mood) moodCount[e.mood] = (moodCount[e.mood] || 0) + 1; });
  const maxMood = Math.max(...Object.values(moodCount), 1);

  const moodRows = MOODS
    .filter(m => moodCount[m.key])
    .sort((a, b) => (moodCount[b.key] || 0) - (moodCount[a.key] || 0))
    .map(m => {
      const cnt  = moodCount[m.key] || 0;
      const pct  = Math.round((cnt / maxMood) * 100);
      return `
        <div class="stat-row">
          <span class="stat-emoji">${m.emoji}</span>
          <span class="stat-label">${m.label}</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:${pct}%"></div>
          </div>
          <span class="stat-count">${cnt}일</span>
        </div>`;
    }).join('');

  // 날씨 집계
  const weatherCount = {};
  entries.forEach(e => { if (e.weather) weatherCount[e.weather] = (weatherCount[e.weather] || 0) + 1; });
  const maxWeather = Math.max(...Object.values(weatherCount), 1);

  const weatherRows = WEATHERS
    .filter(w => weatherCount[w.key])
    .sort((a, b) => (weatherCount[b.key] || 0) - (weatherCount[a.key] || 0))
    .map(w => {
      const cnt  = weatherCount[w.key] || 0;
      const pct  = Math.round((cnt / maxWeather) * 100);
      return `
        <div class="stat-row">
          <span class="stat-emoji">${w.emoji}</span>
          <span class="stat-label">${w.label}</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar weather-bar" style="width:${pct}%"></div>
          </div>
          <span class="stat-count">${cnt}일</span>
        </div>`;
    }).join('');

  // 즐겨찾기 수
  const starCount = entries.filter(e => e.starred).length;

  // 가장 많이 쓴 기분
  const topMoodKey  = Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topMoodInfo = MOODS.find(m => m.key === topMoodKey);

  body.innerHTML = `
    <div class="stats-summary card">
      <div class="stats-summary-row">
        <div class="stats-summary-item">
          <div class="stats-summary-num">${total}</div>
          <div class="stats-summary-desc">총 일기</div>
        </div>
        <div class="stats-summary-item">
          <div class="stats-summary-num">${starCount}</div>
          <div class="stats-summary-desc">즐겨찾기</div>
        </div>
        <div class="stats-summary-item">
          <div class="stats-summary-num">${topMoodInfo ? topMoodInfo.emoji : '—'}</div>
          <div class="stats-summary-desc">대표 기분</div>
        </div>
      </div>
    </div>

    <div class="stats-section card">
      <h3 class="stats-section-title">😊 기분 기록</h3>
      ${moodRows || '<p class="stat-empty">기분을 기록한 일기가 없어요</p>'}
    </div>

    <div class="stats-section card">
      <h3 class="stats-section-title">☁️ 날씨 기록</h3>
      ${weatherRows || '<p class="stat-empty">날씨를 기록한 일기가 없어요</p>'}
    </div>
  `;
}

function prevStatMonth() {
  if (currentStatMonth === 0) { currentStatMonth = 11; currentStatYear--; }
  else currentStatMonth--;
  renderStats();
}

function nextStatMonth() {
  if (currentStatMonth === 11) { currentStatMonth = 0; currentStatYear++; }
  else currentStatMonth++;
  renderStats();
}

function showDetailFromCal(id) { showDetail(id); }
function showWriteFromCal(dateStr) {
  showWrite();
  document.getElementById('entry-date').value = dateStr;
}

/* ══════════════════════════════════════
   화면 전환
══════════════════════════════════════ */
function showList() {
  document.getElementById('view-list').style.display   = '';
  document.getElementById('view-write').style.display  = 'none';
  document.getElementById('view-detail').style.display = 'none';
  renderList(currentSearchQuery);
}

function showWrite(entry) {
  document.getElementById('view-list').style.display   = 'none';
  document.getElementById('view-write').style.display  = '';
  document.getElementById('view-detail').style.display = 'none';

  const today = new Date().toISOString().slice(0, 10);
  renderMoodSelector();
  renderWeatherSelector();

  if (entry) {
    document.getElementById('write-title').textContent  = '일기 수정하기';
    document.getElementById('edit-id').value            = entry.id;
    document.getElementById('entry-date').value         = entry.date;
    document.getElementById('entry-title').value        = entry.title || '';
    document.getElementById('entry-body').value         = entry.body;
    if (entry.mood)    selectMood(entry.mood);
    if (entry.weather) selectWeather(entry.weather);
    currentTags = entry.tags ? [...entry.tags] : [];
  } else {
    document.getElementById('write-title').textContent  = '새 일기 쓰기';
    document.getElementById('edit-id').value            = '';
    document.getElementById('entry-date').value         = today;
    document.getElementById('entry-title').value        = '';
    document.getElementById('entry-body').value         = '';
    document.getElementById('entry-mood').value         = '';
    document.getElementById('entry-weather').value      = '';
    currentTags = [];
  }
  renderTagChips();
}

async function showDetail(id) {
  // Firestore에서 직접 1건 읽기
  const doc = await entriesRef().doc(id).get();
  if (!doc.exists) return;
  const entry = { id: doc.id, ...doc.data() };

  currentDetailId = id;
  document.getElementById('view-list').style.display   = 'none';
  document.getElementById('view-write').style.display  = 'none';
  document.getElementById('view-detail').style.display = '';

  document.getElementById('detail-date').textContent = formatDate(entry.date);
  const moodInfo    = MOODS.find(m => m.key === entry.mood);
  const weatherInfo = WEATHERS.find(w => w.key === entry.weather);
  document.getElementById('detail-mood').textContent    = moodInfo    ? `${moodInfo.emoji} ${moodInfo.label}`       : '';
  document.getElementById('detail-weather').textContent = weatherInfo ? `${weatherInfo.emoji} ${weatherInfo.label}` : '';
  document.getElementById('detail-title').textContent   = entry.title || '(제목 없음)';
  // 태그
  const tagsEl = document.getElementById('detail-tags');
  tagsEl.innerHTML = (entry.tags && entry.tags.length)
    ? entry.tags.map(t => `<span class="tag-chip readonly">#${escapeHtml(t)}</span>`).join('')
    : '';
  document.getElementById('detail-body').textContent    = entry.body;
  // 별표 버튼 상태
  const starBtn = document.getElementById('detail-star-btn');
  starBtn.textContent = entry.starred ? '⭐' : '☆';
  starBtn.classList.toggle('starred', !!entry.starred);
}

/* ══════════════════════════════════════
   CRUD
══════════════════════════════════════ */
async function saveEntry() {
  const id      = document.getElementById('edit-id').value;
  const date    = document.getElementById('entry-date').value;
  const title   = document.getElementById('entry-title').value.trim();
  const body    = document.getElementById('entry-body').value.trim();
  const mood    = document.getElementById('entry-mood').value;
  const weather = document.getElementById('entry-weather').value;

  if (!date) { alert('날짜를 선택해 주세요.'); return; }
  if (!body) { alert('일기 내용을 적어 주세요.'); return; }

  const tags = [...currentTags];
  const data = { date, title, body, mood, weather, tags, updatedAt: Date.now() };

  try {
    if (id) {
      await entriesRef().doc(id).update(data);
    } else {
      await entriesRef().add({ ...data, createdAt: Date.now() });
    }
    showList();
  } catch (err) {
    alert('저장 중 문제가 생겼어요: ' + err.message);
  }
}

async function editEntry() {
  const doc = await entriesRef().doc(currentDetailId).get();
  if (doc.exists) showWrite({ id: doc.id, ...doc.data() });
}

async function deleteEntry() {
  if (!confirm('정말 이 일기를 삭제할까요?')) return;
  try {
    await entriesRef().doc(currentDetailId).delete();
    currentDetailId = null;
    showList();
  } catch (err) {
    alert('삭제 중 문제가 생겼어요: ' + err.message);
  }
}

/* ══════════════════════════════════════
   검색
══════════════════════════════════════ */
function searchEntries(query) {
  currentSearchQuery = query;
  renderList(query);
}

/* ══════════════════════════════════════
   목록 렌더링
══════════════════════════════════════ */
async function renderList(query) {
  const list     = document.getElementById('entry-list');
  const emptyMsg = document.getElementById('empty-msg');

  list.innerHTML = '<p style="text-align:center;color:#b08090;padding:32px 0;">불러오는 중...</p>';
  emptyMsg.style.display = 'none';

  let entries = await loadEntries();

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    entries = entries.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
    );
  }

  if (currentFilterStarred) {
    entries = entries.filter(e => e.starred);
  }

  if (entries.length === 0) {
    list.innerHTML = '';
    emptyMsg.style.display = '';
    return;
  }

  list.innerHTML = entries.map(e => {
    const moodInfo    = MOODS.find(m => m.key === e.mood);
    const weatherInfo = WEATHERS.find(w => w.key === e.weather);
    const moodBadge    = moodInfo    ? `<span class="entry-item-mood">${moodInfo.emoji} ${moodInfo.label}</span>`         : '';
    const weatherBadge = weatherInfo ? `<span class="entry-item-weather">${weatherInfo.emoji} ${weatherInfo.label}</span>` : '';
    const starMark  = e.starred ? `<span class="entry-item-star">⭐</span>` : '';
    const tagBadges = (e.tags && e.tags.length)
      ? `<div class="entry-item-tags">${e.tags.map(t => `<span class="tag-chip small">#${escapeHtml(t)}</span>`).join('')}</div>`
      : '';
    return `
      <div class="entry-item" onclick="showDetail('${e.id}')">
        <div class="entry-item-date">${formatDate(e.date)} ${moodBadge}${weatherBadge}${starMark}</div>
        <div class="entry-item-title">${escapeHtml(e.title || '(제목 없음)')}</div>
        ${tagBadges}
        <div class="entry-item-preview">${escapeHtml(e.body)}</div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════
   유틸
══════════════════════════════════════ */
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const day  = days[new Date(dateStr).getDay()];
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${day})`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
