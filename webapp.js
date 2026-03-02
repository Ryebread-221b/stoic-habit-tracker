const STORAGE_KEY = "stoic-habit-grid-v1";
const LAYOUT_WIDTH_KEY = "stoic-habit-layout-width-v1";
const FRIEND_SNAPSHOT_KEY = "stoic-habit-friend-snapshot-v1";
const HABIT_DEFAULTS = [
  { name: "ランニング", goal: 20 },
  { name: "勉強", goal: 30 },
  { name: "断酒", goal: 30 },
  { name: "健康な食事", goal: 30 },
  { name: "英語の勉強", goal: 30 },
  { name: "筋トレ", goal: 20 },
];

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const state = {
  selectedDate: toYmd(new Date()),
  habits: HABIT_DEFAULTS,
  records: {},
  friendSnapshot: null,
  viewMode: "self",
};

const ui = {
  layout: document.querySelector(".layout"),
  layoutResizer: document.getElementById("layoutResizer"),
  dateInput: document.getElementById("dateInput"),
  loadDateBtn: document.getElementById("loadDateBtn"),
  todayBtn: document.getElementById("todayBtn"),
  newHabitName: document.getElementById("newHabitName"),
  newHabitGoal: document.getElementById("newHabitGoal"),
  addHabitBtn: document.getElementById("addHabitBtn"),
  quickAddHabitBtn: document.getElementById("quickAddHabitBtn"),
  habitEditorMessage: document.getElementById("habitEditorMessage"),
  createShareBtn: document.getElementById("createShareBtn"),
  toggleFriendViewBtn: document.getElementById("toggleFriendViewBtn"),
  viewModeBadge: document.getElementById("viewModeBadge"),
  shareCodeOutput: document.getElementById("shareCodeOutput"),
  friendShareInput: document.getElementById("friendShareInput"),
  loadFriendShareBtn: document.getElementById("loadFriendShareBtn"),
  shareMessage: document.getElementById("shareMessage"),
  monthTitle: document.getElementById("monthTitle"),
  habitTable: document.getElementById("habitTable"),
  monthlyDonut: document.getElementById("monthlyDonut"),
  monthlyPercent: document.getElementById("monthlyPercent"),
  monthlyCount: document.getElementById("monthlyCount"),
  topHabits: document.getElementById("topHabits"),
  dailyBars: document.getElementById("dailyBars"),
};

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function keyOf(habitName, ymd) {
  return `${habitName}::${ymd}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.habits) && parsed.habits.length > 0) {
      state.habits = parsed.habits;
    }
    if (parsed.records && typeof parsed.records === "object") {
      state.records = parsed.records;
    }
  } catch (_err) {
    state.habits = HABIT_DEFAULTS;
    state.records = {};
  }

  try {
    const rawFriend = localStorage.getItem(FRIEND_SNAPSHOT_KEY);
    if (!rawFriend) return;
    const parsedFriend = JSON.parse(rawFriend);
    if (Array.isArray(parsedFriend.habits) && parsedFriend.records && typeof parsedFriend.records === "object") {
      state.friendSnapshot = parsedFriend;
    }
  } catch (_err) {
    state.friendSnapshot = null;
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      habits: state.habits,
      records: state.records,
    })
  );
}

function getDashboardWidth() {
  const raw = localStorage.getItem(LAYOUT_WIDTH_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function setDashboardWidth(widthPx) {
  const rounded = Math.round(widthPx);
  document.documentElement.style.setProperty("--dashboard-width", `${rounded}px`);
  localStorage.setItem(LAYOUT_WIDTH_KEY, String(rounded));
}

function activeHabits() {
  if (state.viewMode === "friend" && state.friendSnapshot) return state.friendSnapshot.habits;
  return state.habits;
}

function activeRecords() {
  if (state.viewMode === "friend" && state.friendSnapshot) return state.friendSnapshot.records;
  return state.records;
}

function isFriendMode() {
  return state.viewMode === "friend" && Boolean(state.friendSnapshot);
}

function isCheckedFrom(records, habitName, ymd) {
  return Boolean(records[`${habitName}::${ymd}`]);
}

function isChecked(habitName, ymd) {
  return Boolean(state.records[keyOf(habitName, ymd)]);
}

function setChecked(habitName, ymd, checked) {
  const k = keyOf(habitName, ymd);
  if (checked) {
    state.records[k] = true;
  } else {
    delete state.records[k];
  }
  saveState();
}

function habitExists(name, excludeIndex = -1) {
  return state.habits.some((h, i) => i !== excludeIndex && h.name === name);
}

function addHabit(name, goal) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "項目名を入力してください。" };
  if (habitExists(trimmed)) return { ok: false, reason: "同じ項目名は追加できません。" };

  const safeGoal = Number.isFinite(goal) ? Math.max(1, Math.min(31, Math.floor(goal))) : 30;
  state.habits.push({ name: trimmed, goal: safeGoal });
  saveState();
  return { ok: true, reason: `「${trimmed}」を追加しました。` };
}

function renameHabit(index, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  if (habitExists(trimmed, index)) return false;

  const oldName = state.habits[index].name;
  if (oldName === trimmed) return true;
  state.habits[index].name = trimmed;

  const oldPrefix = `${oldName}::`;
  const moved = {};
  Object.keys(state.records).forEach((key) => {
    if (key.startsWith(oldPrefix)) {
      const suffix = key.slice(oldPrefix.length);
      moved[`${trimmed}::${suffix}`] = true;
      delete state.records[key];
    }
  });
  Object.assign(state.records, moved);
  saveState();
  return true;
}

function updateHabitGoal(index, newGoal) {
  const n = Math.max(1, Math.min(31, Math.floor(Number(newGoal) || 0)));
  if (!n) return false;
  state.habits[index].goal = n;
  saveState();
  return true;
}

function deleteHabit(index) {
  const target = state.habits[index];
  if (!target) return;
  const prefix = `${target.name}::`;
  Object.keys(state.records).forEach((key) => {
    if (key.startsWith(prefix)) delete state.records[key];
  });
  state.habits.splice(index, 1);
  saveState();
}

function monthContext() {
  const d = fromYmd(state.selectedDate);
  const year = d.getFullYear();
  const monthIndex = d.getMonth();
  const day = d.getDate();
  const totalDays = daysInMonth(year, monthIndex);
  return { year, monthIndex, day, totalDays };
}

function percent(done, total) {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function countHabitDoneInMonth(habitName, year, monthIndex, totalDays) {
  const records = activeRecords();
  let done = 0;
  for (let i = 1; i <= totalDays; i += 1) {
    const ymd = toYmd(new Date(year, monthIndex, i));
    if (isCheckedFrom(records, habitName, ymd)) done += 1;
  }
  return done;
}

function buildWeekGroups(totalDays) {
  const groups = [];
  let day = 1;
  let weekNo = 1;
  while (day <= totalDays) {
    const span = Math.min(7, totalDays - day + 1);
    groups.push({ weekNo, start: day, span });
    day += span;
    weekNo += 1;
  }
  return groups;
}

function renderTrackerTable() {
  const { year, monthIndex, day, totalDays } = monthContext();
  const friendMode = isFriendMode();
  const habits = activeHabits();
  const records = activeRecords();
  const today = new Date();
  const todayYmd = toYmd(today);

  const table = ui.habitTable;
  table.innerHTML = "";

  const thead = document.createElement("thead");
  const rowWeek = document.createElement("tr");
  const rowDay = document.createElement("tr");

  const habitHead = document.createElement("th");
  habitHead.rowSpan = 2;
  habitHead.textContent = "DAILY HABITS";
  habitHead.className = "habit-col";

  const goalHead = document.createElement("th");
  goalHead.rowSpan = 2;
  goalHead.textContent = "GOALS";
  goalHead.className = "goal-col";

  const actionHead = document.createElement("th");
  actionHead.rowSpan = 2;
  actionHead.textContent = "EDIT";
  actionHead.className = "action-col";

  rowWeek.append(habitHead, goalHead, actionHead);

  const weekGroups = buildWeekGroups(totalDays);
  weekGroups.forEach((g) => {
    const th = document.createElement("th");
    th.colSpan = g.span;
    th.className = "week-header";
    th.textContent = `WEEK ${g.weekNo}`;
    rowWeek.appendChild(th);
  });

  for (let d = 1; d <= totalDays; d += 1) {
    const date = new Date(year, monthIndex, d);
    const th = document.createElement("th");
    th.className = "day-header";

    const weekday = document.createElement("span");
    weekday.textContent = WEEKDAY_SHORT[date.getDay()];

    const num = document.createElement("span");
    num.className = "day-num";
    num.textContent = String(d);

    th.append(weekday, num);

    if (d === day) {
      th.classList.add("today-col");
    }

    rowDay.appendChild(th);
  }

  thead.append(rowWeek, rowDay);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  habits.forEach((habit, idx) => {
    const tr = document.createElement("tr");

    const habitCell = document.createElement("th");
    habitCell.className = "habit-col";
    const habitInput = document.createElement("input");
    habitInput.type = "text";
    habitInput.className = "habit-input";
    habitInput.value = habit.name;
    habitInput.setAttribute("aria-label", "習慣名");
    if (friendMode) {
      habitInput.readOnly = true;
      habitInput.disabled = true;
    } else {
      habitInput.addEventListener("change", () => {
        const ok = renameHabit(idx, habitInput.value);
        if (!ok) {
          habitInput.value = state.habits[idx]?.name || "";
        }
        renderAll();
      });
    }
    habitCell.appendChild(habitInput);

    const goalCell = document.createElement("td");
    goalCell.className = "goal-col";
    const goalInput = document.createElement("input");
    goalInput.type = "number";
    goalInput.min = "1";
    goalInput.max = "31";
    goalInput.className = "goal-input";
    goalInput.value = String(habit.goal);
    goalInput.setAttribute("aria-label", "目標回数");
    if (friendMode) {
      goalInput.readOnly = true;
      goalInput.disabled = true;
    } else {
      goalInput.addEventListener("change", () => {
        updateHabitGoal(idx, goalInput.value);
        renderDashboard();
      });
    }
    goalCell.appendChild(goalInput);

    const actionCell = document.createElement("td");
    actionCell.className = "action-col";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-habit-btn";
    deleteBtn.textContent = "×";
    deleteBtn.title = "項目削除";
    if (friendMode) {
      deleteBtn.disabled = true;
    } else {
      deleteBtn.addEventListener("click", () => {
        deleteHabit(idx);
        renderAll();
      });
    }
    actionCell.appendChild(deleteBtn);

    tr.append(habitCell, goalCell, actionCell);

    for (let d = 1; d <= totalDays; d += 1) {
      const date = new Date(year, monthIndex, d);
      const ymd = toYmd(date);
      const td = document.createElement("td");
      if (d === day) td.classList.add("today-col");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "cell-check";
      checkbox.checked = isCheckedFrom(records, habit.name, ymd);
      checkbox.setAttribute("aria-label", `${habit.name} ${ymd}`);
      if (friendMode) {
        checkbox.disabled = true;
      } else {
        checkbox.addEventListener("change", () => {
          setChecked(habit.name, ymd, checkbox.checked);
          renderDashboard();
        });
      }

      td.appendChild(checkbox);
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  ui.monthTitle.textContent = `MONTHLY TRACKER ${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  if (todayYmd.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}`)) {
    const sheet = document.querySelector(".sheet-wrap");
    if (sheet) {
      const targetX = Math.max(0, (day - 3) * 36);
      sheet.scrollLeft = targetX;
    }
  }
}

function drawDonut(svg, done, total) {
  svg.innerHTML = "";
  const ratio = total > 0 ? done / total : 0;
  const circumference = 2 * Math.PI * 70;
  const progress = circumference * ratio;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.setAttribute("id", "donutGradient");
  gradient.setAttribute("x1", "0%");
  gradient.setAttribute("x2", "100%");
  gradient.setAttribute("y1", "0%");
  gradient.setAttribute("y2", "100%");

  const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", "#66b2ff");
  const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", "#245394");
  gradient.append(stop1, stop2);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", "110");
  bg.setAttribute("cy", "110");
  bg.setAttribute("r", "70");
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", "#d6dfeb");
  bg.setAttribute("stroke-width", "24");
  svg.appendChild(bg);

  const fg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fg.setAttribute("cx", "110");
  fg.setAttribute("cy", "110");
  fg.setAttribute("r", "70");
  fg.setAttribute("fill", "none");
  fg.setAttribute("stroke", "url(#donutGradient)");
  fg.setAttribute("stroke-width", "24");
  fg.setAttribute("stroke-linecap", "round");
  fg.setAttribute("transform", "rotate(-90 110 110)");
  fg.setAttribute("stroke-dasharray", `${progress} ${circumference}`);
  svg.appendChild(fg);

  const inner = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  inner.setAttribute("cx", "110");
  inner.setAttribute("cy", "110");
  inner.setAttribute("r", "48");
  inner.setAttribute("fill", "#ffffff");
  inner.setAttribute("stroke", "#e2e8f0");
  inner.setAttribute("stroke-width", "1");
  svg.appendChild(inner);
}

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function renderTopHabits(year, monthIndex, totalDays) {
  const habits = activeHabits();
  const rows = habits.map((h) => {
    const done = countHabitDoneInMonth(h.name, year, monthIndex, totalDays);
    const rate = percent(done, h.goal);
    return { name: h.name, done, goal: h.goal, rate };
  });

  rows.sort((a, b) => b.rate - a.rate);
  ui.topHabits.innerHTML = "";

  rows.forEach((row) => {
    const li = document.createElement("li");
    li.className = "top-item";

    const line = document.createElement("div");
    line.className = "top-line";
    const name = document.createElement("span");
    name.textContent = row.name;
    const meta = document.createElement("span");
    meta.textContent = `${row.done}/${row.goal} (${row.rate}%)`;
    line.append(name, meta);

    const track = document.createElement("div");
    track.className = "top-bar-track";
    const fill = document.createElement("div");
    fill.className = "top-bar-fill";
    fill.style.width = `${Math.min(100, row.rate)}%`;
    track.appendChild(fill);

    li.append(line, track);
    ui.topHabits.appendChild(li);
  });
}

function renderDailyBars(year, monthIndex, totalDays) {
  ui.dailyBars.innerHTML = "";
  const habits = activeHabits();
  const records = activeRecords();

  const selected = fromYmd(state.selectedDate);
  const selectedDay = selected.getDate();
  const maxValue = Math.max(1, habits.length);

  for (let d = 1; d <= totalDays; d += 1) {
    const ymd = toYmd(new Date(year, monthIndex, d));
    let done = 0;
    habits.forEach((h) => {
      if (isCheckedFrom(records, h.name, ymd)) done += 1;
    });

    const bar = document.createElement("div");
    bar.className = "bar";
    if (d === selectedDay) bar.classList.add("is-today");
    const h = Math.max(4, Math.round((done / maxValue) * 100));
    bar.style.height = `${h}%`;
    bar.title = `${d}日: ${done}/${maxValue}`;
    ui.dailyBars.appendChild(bar);
  }
}

function renderDashboard() {
  const { year, monthIndex, totalDays } = monthContext();
  const habits = activeHabits();

  let done = 0;
  habits.forEach((habit) => {
    done += countHabitDoneInMonth(habit.name, year, monthIndex, totalDays);
  });

  const total = habits.length * totalDays;
  const p = percent(done, total);

  drawDonut(ui.monthlyDonut, done, total);
  ui.monthlyPercent.textContent = `${p}%`;
  ui.monthlyCount.textContent = `${done} / ${total}`;

  renderTopHabits(year, monthIndex, totalDays);
  renderDailyBars(year, monthIndex, totalDays);
}

function setEditorMessage(text, type = "") {
  ui.habitEditorMessage.textContent = text;
  ui.habitEditorMessage.classList.remove("ok", "err");
  if (type) ui.habitEditorMessage.classList.add(type);
}

function setShareMessage(text, type = "") {
  ui.shareMessage.textContent = text;
  ui.shareMessage.classList.remove("ok", "err");
  if (type) ui.shareMessage.classList.add(type);
}

function encodeShareData(payload) {
  try {
    const json = JSON.stringify(payload);
    return `share:${encodeURIComponent(json)}`;
  } catch (_err) {
    try {
      return `share:${encodeURIComponent(JSON.stringify(payload))}`;
    } catch (_err2) {
      return "";
    }
  }
}

function decodeShareData(code) {
  try {
    if (code.startsWith("share:")) {
      const raw = code.slice("share:".length);
      return JSON.parse(decodeURIComponent(raw));
    }
    const binary = atob(code);
    return JSON.parse(binary);
  } catch (_err) {
    if (code.startsWith("{")) return JSON.parse(code);
    throw new Error("invalid share code");
  }
}

function buildShareLink(code) {
  const url = new URL(window.location.href);
  url.hash = `share=${encodeURIComponent(code)}`;
  return url.toString();
}

function extractShareCode(input) {
  const raw = (input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("share:") || raw.startsWith("{")) return raw;

  try {
    const url = new URL(raw, window.location.href);
    const fromQuery = url.searchParams.get("share");
    if (fromQuery) return fromQuery;
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    if (hash.startsWith("share=")) return hash.slice("share=".length);
  } catch (_err) {
    const params = new URLSearchParams(raw.replace(/^\?/, ""));
    const fromParams = params.get("share");
    if (fromParams) return fromParams;
  }

  return raw;
}

function applyFriendPayload(payload) {
  if (!Array.isArray(payload.habits) || !payload.records || typeof payload.records !== "object") {
    throw new Error("invalid payload");
  }
  state.friendSnapshot = {
    habits: payload.habits,
    records: payload.records,
  };
  localStorage.setItem(FRIEND_SNAPSHOT_KEY, JSON.stringify(state.friendSnapshot));
}

function loadFriendFromInput(input) {
  const code = extractShareCode(input);
  if (!code) return false;
  const payload = decodeShareData(code);
  applyFriendPayload(payload);
  return true;
}

function updateModeUI() {
  if (isFriendMode()) {
    ui.viewModeBadge.textContent = "FRIEND MODE";
    ui.viewModeBadge.classList.add("friend");
    ui.toggleFriendViewBtn.textContent = "自分の進捗に戻る";
  } else {
    ui.viewModeBadge.textContent = "SELF MODE";
    ui.viewModeBadge.classList.remove("friend");
    ui.toggleFriendViewBtn.textContent = "友達の進捗を見る";
  }

  const lock = isFriendMode();
  ui.newHabitName.disabled = lock;
  ui.newHabitGoal.disabled = lock;
  ui.addHabitBtn.disabled = lock;
  ui.quickAddHabitBtn.disabled = lock;
}

function tryAddHabitFromEditor() {
  const name = ui.newHabitName.value;
  const goal = Number(ui.newHabitGoal.value || 30);
  const result = addHabit(name, goal);
  if (!result.ok) {
    setEditorMessage(result.reason, "err");
    return;
  }
  ui.newHabitName.value = "";
  ui.newHabitGoal.value = "";
  setEditorMessage(result.reason, "ok");
  renderAll();
}

function renderAll() {
  ui.dateInput.value = state.selectedDate;
  updateModeUI();
  renderTrackerTable();
  renderDashboard();
}

function wireLayoutResizer() {
  const resizer = ui.layoutResizer;
  if (!resizer || !ui.layout) return;

  const saved = getDashboardWidth();
  if (saved) {
    setDashboardWidth(saved);
  }

  let dragging = false;

  const onMove = (event) => {
    if (!dragging) return;
    if (window.innerWidth <= 1100) return;

    const rect = ui.layout.getBoundingClientRect();
    const minSidebar = 320;
    const maxSidebar = Math.max(340, rect.width - 520);
    const pointerX = event.clientX;
    const desired = rect.right - pointerX;
    const next = Math.min(maxSidebar, Math.max(minSidebar, desired));
    setDashboardWidth(next);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("is-resizing");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  resizer.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 1100) return;
    dragging = true;
    document.body.classList.add("is-resizing");
    resizer.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function wireEvents() {
  ui.loadDateBtn.addEventListener("click", () => {
    if (!ui.dateInput.value) return;
    state.selectedDate = ui.dateInput.value;
    renderAll();
  });

  ui.todayBtn.addEventListener("click", () => {
    state.selectedDate = toYmd(new Date());
    renderAll();
  });

  ui.addHabitBtn.addEventListener("click", () => {
    if (isFriendMode()) return;
    tryAddHabitFromEditor();
  });

  ui.quickAddHabitBtn.addEventListener("click", () => {
    if (isFriendMode()) return;
    const name = window.prompt("追加する項目名を入力してください");
    if (!name) return;
    const goalInput = window.prompt("目標回数を入力してください (1-31)", "30");
    const goal = Number(goalInput || 30);
    const result = addHabit(name, goal);
    if (!result.ok) {
      setEditorMessage(result.reason, "err");
      return;
    }
    setEditorMessage(result.reason, "ok");
    renderAll();
  });

  ui.newHabitName.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (isFriendMode()) return;
    tryAddHabitFromEditor();
  });

  ui.newHabitGoal.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (isFriendMode()) return;
    tryAddHabitFromEditor();
  });

  ui.createShareBtn.addEventListener("click", async () => {
    setShareMessage("共有リンクを作成中...", "ok");
    const code = encodeShareData({
      habits: state.habits,
      records: state.records,
      sharedAt: new Date().toISOString(),
    });
    if (!code) {
      setShareMessage("共有コードの作成に失敗しました。", "err");
      return;
    }
    const shareLink = buildShareLink(code);
    ui.shareCodeOutput.value = shareLink;
    ui.shareCodeOutput.focus();
    ui.shareCodeOutput.select();
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareMessage("共有リンクを作成し、クリップボードにコピーしました。", "ok");
    } catch (_err) {
      setShareMessage("共有リンクを作成しました。下の欄からコピーして共有してください。", "ok");
    }
  });

  ui.loadFriendShareBtn.addEventListener("click", () => {
    if (!ui.friendShareInput.value.trim()) {
      setShareMessage("友達コードを入力してください。", "err");
      return;
    }
    try {
      const ok = loadFriendFromInput(ui.friendShareInput.value);
      if (!ok) {
        setShareMessage("友達コードを入力してください。", "err");
        return;
      }
      setShareMessage("友達コードを読み込みました。", "ok");
      renderAll();
    } catch (_err) {
      setShareMessage("友達コードの形式が正しくありません。", "err");
    }
  });

  ui.toggleFriendViewBtn.addEventListener("click", () => {
    if (state.viewMode === "self") {
      if (!state.friendSnapshot) {
        setShareMessage("先に友達コードを読み込んでください。", "err");
        return;
      }
      state.viewMode = "friend";
      setShareMessage("友達の進捗を表示中です。", "ok");
    } else {
      state.viewMode = "self";
      setShareMessage("自分の進捗表示に戻しました。", "ok");
    }
    renderAll();
  });
}

loadState();
try {
  const url = new URL(window.location.href);
  const shareFromQuery = url.searchParams.get("share");
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const shareFromHash = hash.startsWith("share=") ? decodeURIComponent(hash.slice("share=".length)) : "";
  const incoming = shareFromQuery || shareFromHash;
  if (incoming) {
    loadFriendFromInput(incoming);
    state.viewMode = "friend";
  }
} catch (_err) {
  // ignore URL parse errors
}
wireLayoutResizer();
wireEvents();
renderAll();
