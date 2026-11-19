const DAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const FULL = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let state, tab = "home", selectedDay = (new Date().getDay() + 6) % 7, weekOffset = 0, editing = null, calendarMonthOffset = 0, selectedCalendarDate = dateKey(new Date());

const today = new Date();
const monday = d => {
  let x = new Date(d);
  x.setHours(0,0,0,0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
let weekStart = monday(today);

function dateKey(d) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0,10);
}
function dateFor(i) {
  let d = new Date(weekStart);
  d.setDate(d.getDate() + i + weekOffset * 7);
  return d;
}

function normalizeState(data) {
  const s = data && typeof data === "object" ? data : {};
  s.tasks = Array.isArray(s.tasks) ? s.tasks : [];
  s.dailyHabits = Array.isArray(s.dailyHabits) ? s.dailyHabits : [];
  s.weeklyHabits = Array.isArray(s.weeklyHabits) ? s.weeklyHabits : [];
  const currentWeek = dateKey(monday(new Date()));
  s.weeklyHabits.forEach(h => {
    if (!h.doneWeeks || typeof h.doneWeeks !== "object" || Array.isArray(h.doneWeeks)) h.doneWeeks = {};
    if (h.done === true && h.doneWeeks[currentWeek] === undefined) h.doneWeeks[currentWeek] = true;
  });
  s.notes = Array.isArray(s.notes) ? s.notes : [];
  s.diaryEntries = Array.isArray(s.diaryEntries) ? s.diaryEntries : [];
  s.calendarEntries = Array.isArray(s.calendarEntries) ? s.calendarEntries : [];
  s.archive = Array.isArray(s.archive) ? s.archive : [];
  s.quotes = Array.isArray(s.quotes) ? s.quotes : [];
  s.theme = s.theme || "lavender";
  s.hiddenTabs = Array.isArray(s.hiddenTabs) ? s.hiddenTabs.filter(x => ["week","cycle","diary","calendar"].includes(x)) : [];
  if (!s.themeStyleV2) { s.theme = "lavender"; s.themeStyleV2 = true; }
  s.moods = s.moods && typeof s.moods === "object" ? s.moods : {};
  s.selfCareLog = s.selfCareLog && typeof s.selfCareLog === "object" ? s.selfCareLog : {};
  s.goals = Array.isArray(s.goals) ? s.goals : [];
  s.reminder = s.reminder || "20:00";
  s.reminderEnabled = Boolean(s.reminderEnabled);
  s.dailyHabits.forEach(h => {
    if (!Array.isArray(h.done)) h.done = Array(7).fill(false);
    h.done = Array.from({length:7}, (_,i) => Boolean(h.done[i]));
  });
  if (!s.unifiedTasksV1) {
    const start = monday(new Date());
    s.tasks = s.tasks.map(t => {
      if (t.date || t.repeatDaily) return t;
      if (Number.isInteger(Number(t.day))) {
        const d = new Date(start); d.setDate(d.getDate()+Number(t.day));
        const date = dateKey(d);
        return {...t,date,doneDates:t.done?{...(t.doneDates||{}),[date]:true}:(t.doneDates||{})};
      }
      return t;
    });
    s.dailyHabits.forEach(h => {
      const doneDates = {};
      h.done.forEach((done,i) => { if(done){const d=new Date(start);d.setDate(d.getDate()+i);doneDates[dateKey(d)]=true;} });
      s.tasks.push({id:h.id||("legacy-"+Math.random().toString(36).slice(2)),title:h.name||"Задача",repeatDaily:true,doneDates});
    });
    s.dailyHabits = [];
    s.unifiedTasksV1 = true;
  }
  s.tasks = s.tasks.map(t => ({...t,doneDates:t.doneDates&&typeof t.doneDates==="object"?t.doneDates:{}}));
  return s;
}

function save() {
  const userId = window.plannerCurrentUserId;
  const key = userId ? "softPlanner:user:" + userId : "softPlanner";
  try {
    localStorage.setItem(key, JSON.stringify(state));
    const status = $("#storageStatus");
    if (status) status.textContent = userId ? "♡ Ты в своём аккаунте · синхронизация включена" : "Данные хранятся на этом устройстве";
  } catch (error) {
    const status = $("#storageStatus");
    if (status) status.textContent = "Хранение на устройстве недоступно — записи пока останутся открытыми в этой вкладке";
    console.warn("Planner local storage is unavailable", error);
  }
  if (userId && typeof window.plannerCloudSave === "function") {
    try { window.plannerCloudSave(state); }
    catch (error) { console.warn("Planner cloud save failed", error); }
  }
}

window.addEventListener("planner-cloud-load", event => {
  state = normalizeState(event.detail || {});
  save();
  quote();
  render();
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"'"
  }[c]));
}

let quoteBank = [];

function cleanQuoteText(value) {
  return String(value ?? "")
    .replace(/^\\s*(?:(?:мудрая\\s+мысль|мысль\\s+дня|цитата(?:\\s+дня)?|путь\\s+к\\s+мечте|мотивация|любовь\\s+к\\s+себе|вдохновение|напоминание\\s+себе)[^:\\n]{0,80}:\\s*)/i, "")
    .trim();
}

function quote() {
  const savedQuotes = Array.isArray(state?.quotes) ? state.quotes : [];
  const quotes = quoteBank.length ? quoteBank : savedQuotes;
  const q = quotes.length ? cleanQuoteText(quotes[Math.floor(Math.random() * quotes.length)]) : "";
  const box = $("#quoteBox");
  if (box) box.innerHTML = '<span class="quote-text">' + escapeHtml(q || "Маленькие шаги тоже важны ♡") + '</span><button class="quote-copy" type="button" aria-label="Скопировать цитату" title="Скопировать цитату">Копировать</button>';
}

function applyTheme() {
  document.body.className = state.theme === "pink" ? "" : "theme-" + state.theme;
  const styles = getComputedStyle(document.body);
  const bg = styles.getPropertyValue("--bg").trim() || "#f8f7fd";
  const accent = styles.getPropertyValue("--accent").trim() || "#9994c9";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${bg}"/><rect x="112" y="82" width="288" height="348" rx="34" fill="${accent}"/><rect x="136" y="106" width="240" height="300" rx="22" fill="#fff"/><path d="M176 154h160M176 190h160M176 226h72" stroke="${bg}" stroke-width="13" stroke-linecap="round"/><path d="M256 333c-14-12-55-38-55-69 0-32 39-42 55-13 16-29 55-19 55 13 0 31-41 57-55 69Z" fill="${accent}"/></svg>`;
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) { favicon = document.createElement("link"); favicon.rel = "icon"; document.head.appendChild(favicon); }
  favicon.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = bg;
}

function tasksForDate(date) {
  return state.tasks.filter(t => !t.archived && (t.repeatDaily || t.date === date));
}
function taskIsDone(task,date) {
  return Boolean(task.doneDates?.[date] ?? (!task.date && !task.repeatDaily && task.done));
}
function dayTasks(day) {
  return tasksForDate(dateKey(dateFor(day)));
}
function weekStartKey(date) {
  return dateKey(monday(new Date(date+"T12:00:00")));
}
function weekKey(offset = 0) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset * 7);
  return dateKey(d);
}
function weeklyDone(h, key) { return Boolean(h.doneWeeks && h.doneWeeks[key]); }
function weeklyHabitRow(h, key) {
  const done = weeklyDone(h, key);
  return `<div class="item ${done?"done":""}"><button class="check ${done?"on":""}" data-weekly-habit="${h.id}" data-week-key="${key}" aria-label="${done?"Отметить невыполненным":"Отметить выполненным"}">${done?"✓":""}</button><span class="itemtext">${escapeHtml(h.name)}</span><button class="mini icon-edit" data-edit-weekly-habit="${h.id}" aria-label="Изменить" title="Изменить">✎</button></div>`;
}

function pct(done,total) {
  return total ? Math.round(done / total * 100) : 0;
}

function render() {
  if (!state) return;
  applyTheme();
  $("#todayLabel").textContent = today.toLocaleDateString("ru-RU", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  });
  const hiddenTabs = state.hiddenTabs || [];
  if (hiddenTabs.includes(tab)) tab = "home";
  const tabButtons = $$("#tabs button");
  tabButtons.forEach(b => {
    b.hidden = hiddenTabs.includes(b.dataset.tab);
    if (!b.hidden) b.classList.remove("is-hiding");
    b.setAttribute("aria-hidden", String(b.hidden));
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  $("#tabs").style.setProperty("--visible-tabs", Math.max(1, Array.from(tabButtons).filter(b => !b.hidden).length));
  let v = $("#view");
  ({home, week, calendar, cycle: window.cycleTab, diary, settings: settingsView}[tab] || home)(v);
}

function section(title, sub = "") {
  return `<div class="row between"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div></div>`;
}

function progress(n) {
  return `<div class="progress"><i style="width:${Math.max(0,Math.min(100,n))}%"></i></div>`;
}

function home(v) {
 const td=(today.getDay()+6)%7, todayKey=dateKey(today), todays=tasksForDate(todayKey), done=todays.filter(t=>taskIsDone(t,todayKey)).length;
 const ns=state.notes.filter(n=>Number(n.day??td)===td&&!n.archived), wh=state.weeklyHabits||[], homeWeekKey=weekKey(0);
 v.innerHTML=section("Сегодня","Твоё уютное пространство ♡")+
 `<div class="card home-progress"><div class="row between"><div><div class="muted">Задачи сегодня</div><div class="big">${done} из ${todays.length}</div><div class="soft-caption">Маленькие шаги тоже важны ♡</div></div>${donut(done,todays.length,"выполнено сегодня")}</div></div>
 <div class="card"><div class="row between"><h3>♡ Мои задачи на сегодня</h3></div>${taskList(todays,todayKey)}<button class="primary" data-add="task" data-add-day="${todayKey}">＋ Добавить задачу на сегодня</button></div>
 <div class="card weekly-home"><div class="row between"><h3>✿ Дела на неделю</h3><button class="mini icon-edit" data-go="habits" aria-label="Изменить дела на неделю" title="Изменить">✎</button></div>
 ${wh.map(x=>weeklyHabitRow(x,homeWeekKey)).join("")||'<div class="empty">Добавь одно дело на всю неделю ♡</div>'}
 <button class="primary" data-add="weeklyHabit">＋ Добавить дело на неделю</button></div>
 <div class="card"><div class="row between"><div><h3>✎ Заметка на сегодня</h3><div class="muted">${today.toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</div></div><button class="mini" data-add="note" data-add-day="${td}">＋ Добавить заметку</button></div>
 ${ns.map(n=>`<div class="note-preview"><b>${escapeHtml(n.title||"Заметка")}</b><p>${escapeHtml(n.text)}</p><button class="mini icon-edit" data-edit-note="${n.id}" aria-label="Изменить заметку" title="Изменить">✎</button></div>`).join("")||'<div class="empty">Пусть здесь появится что-то хорошее ♡</div>'}</div>`;
}


const SELF_CARE_ITEMS = ["Выпить достаточно воды","Немного подвигаться","Выйти на свежий воздух","Сделать паузу и отдохнуть","Уход за собой","Лечь спать вовремя"];
function care(v) {
  const day = dateKey(today), mood = state.moods[day] || {}, done = state.selfCareLog[day] || [];
  const notes = state.notes.filter(n => !n.archived).slice(0,8);
  const goals = state.goals || [];
  v.innerHTML = section("Забота о себе","Маленькое внимание к себе каждый день") +
    `<div class="card care-card"><div class="row between"><h3>Как ты сегодня?</h3><span class="muted">${today.toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</span></div>
    <form id="moodForm"><label>Моё настроение<select name="mood"><option value="">Выбери настроение</option>${["Спокойное","Радостное","Вдохновлённое","Усталое","Грустное","Тревожное","Раздражённое"].map(x=>`<option ${mood.mood===x?"selected":""}>${x}</option>`).join("")}</select></label>
    <label>Пара слов о дне<textarea name="note" rows="2" placeholder="Что хочется запомнить?">${escapeHtml(mood.note||"")}</textarea></label><button class="primary">Сохранить настроение</button></form></div>
    <div class="card care-card"><div class="row between"><h3>Мягкая забота</h3><span class="pill">${done.length}/${SELF_CARE_ITEMS.length}</span></div>
    <div class="progress"><i style="width:${Math.round(done.length/SELF_CARE_ITEMS.length*100)}%"></i></div>
    ${SELF_CARE_ITEMS.map((x,i)=>`<label class="care-check"><input type="checkbox" data-care-item="${i}" ${done.includes(i)?"checked":""}> <span>${x}</span></label>`).join("")}</div>
    <div class="card care-card"><div class="row between"><h3>Мои цели</h3><span class="muted">${goals.filter(x=>x.done).length}/${goals.length}</span></div>
    <form id="goalForm" class="inputrow"><input name="title" maxlength="120" placeholder="Маленький шаг к цели…" required><button class="primary">＋</button></form>
    ${goals.map(g=>`<div class="item ${g.done?"done":""}"><button class="check ${g.done?"on":""}" data-goal-toggle="${g.id}">${g.done?"✓":""}</button><span class="itemtext">${escapeHtml(g.title)}</span><button class="mini" data-goal-delete="${g.id}">×</button></div>`).join("")||'<div class="empty">Большие цели начинаются с маленьких шагов.</div>'}</div>
    <div class="card care-card"><div class="row between"><h3>Мои заметки</h3><button class="mini" data-add="note" data-add-day="${(today.getDay()+6)%7}">＋ Записать</button></div>
    ${notes.map(n=>`<div class="note-preview"><b>${escapeHtml(n.title||"Заметка")}</b><p>${escapeHtml(n.text)}</p><button class="mini icon-edit" data-edit-note="${n.id}" aria-label="Изменить заметку" title="Изменить">✎</button><button class="mini" data-delete-note="${n.id}">Удалить</button></div>`).join("")||'<div class="empty">Сохраняй здесь мысли, идеи и важные моменты.</div>'}</div>
    <div class="care-shortcuts"><button class="ghost" data-go="stats">◔ Мой прогресс</button></div>`;
}
function settingsView(v) {
  const themes = ["pink","peach","blue","beige","green","lavender","brown","dark"];
  const labels = ["Розовая","Персиковая","Голубая","Бежевая","Шалфейная","Лавандовая","Шоколадная","Ночная"];
  const weekly = state.weeklyHabits || [];
  const menuTabs = [{id:"week",label:"Неделя"},{id:"cycle",label:"Цикл"},{id:"diary",label:"Дневник"},{id:"calendar",label:"Календарь"}];
  v.innerHTML = section("Настройки","Оформление и редактирование ♡") +
    `<div class="card"><h3>Что показывать в меню</h3><p class="muted">Скрытые вкладки можно вернуть здесь в любой момент.</p>${menuTabs.map(x=>`<div class="item menu-setting"><span class="itemtext">${x.label}</span><button class="mini ${!(state.hiddenTabs||[]).includes(x.id)?"active":""}" data-toggle-tab="${x.id}">${(state.hiddenTabs||[]).includes(x.id)?"Показать":"Скрыть"}</button></div>`).join("")}<div class="soft-caption">Вкладка «Сегодня» всегда остаётся доступной. Остальные разделы можно скрывать и возвращать.</div></div>
    <div class="card"><h3>Оформление</h3><div class="theme-options">${themes.map((t,i) => `<button class="theme-choice ${state.theme===t?"active":""}" data-theme="${t}">${labels[i]}</button>`).join("")}</div></div>
    <div class="card"><div class="row between"><h3>Мои задачи</h3><button class="mini" data-add="task" data-add-day="${dateKey(today)}">＋ Добавить</button></div>
    ${state.tasks.filter(t=>!t.archived).map(t=>`<div class="item"><span class="itemtext">${escapeHtml(t.title)}</span><button class="mini icon-edit" data-edit-task="${t.id}" aria-label="Изменить задачу" title="Изменить">✎</button></div>`).join("")||'<div class="empty">Задач пока нет</div>'}</div>
    <div class="card"><div class="row between"><h3>Дела на неделю</h3><button class="mini" data-add="weeklyHabit">＋ Добавить</button></div>
    ${weekly.map(h=>`<div class="item"><span class="itemtext">${escapeHtml(h.name)}</span><button class="mini icon-edit" data-edit-weekly-habit="${h.id}" aria-label="Изменить дело" title="Изменить">✎</button></div>`).join("")||'<div class="empty">Дел на неделю пока нет</div>'}</div>`;
}

function more(v) {
  v.innerHTML = section("Ещё","Дополнительные разделы твоего планера ♡") +
    `<div class="card more-links"><button class="ghost" data-go="habits">♡ Задачи и дела на неделю</button><button class="ghost" data-go="notes">✎ Заметки</button><button class="ghost" data-go="stats">◔ Прогресс</button></div>`;
}

function dayPicker() {
  return `<div class="daygrid">${DAYS.map


((d,i) =>
    `<button class="day ${i===selectedDay?"selected":""} ${dayTasks(i).length?"has":""}" data-day="${i}">${d}<strong>${dateFor(i).getDate()}</strong></button>`
  ).join("")}</div>`;
}

function taskList(items,date) {
  return items.length ? items.map(t => {
    const done=taskIsDone(t,date);
    return `<div class="item ${done?"done":""}"><button class="check ${done?"on":""}" data-task="${t.id}" data-task-date="${date}" aria-label="${done?"Отметить невыполненной":"Отметить выполненной"}">${done?"✓":""}</button><span class="itemtext">${escapeHtml(t.title)}</span><button class="mini icon-edit" data-edit-task="${t.id}" aria-label="Изменить задачу" title="Изменить">✎</button></div>`;
  }).join("") : `<div class="empty">Пока нет задач. Добавь первую ♡</div>`;
}

function orderedDays(){return Array.from({length:7},(_,k)=>(selectedDay+k)%7);}
function weekTaskChart(key){
 const weekly=state.weeklyHabits||[];
 const weeklyDoneCount=weekly.filter(h=>weeklyDone(h,key)).length;
 const weeklyPct=pct(weeklyDoneCount,weekly.length);
 const days=Array.from({length:7},(_,i)=>{
  const date=dateKey(dateFor(i)),items=tasksForDate(date);
  const done=items.filter(t=>taskIsDone(t,date)).length;
  return {label:DAYS[i],done,total:items.length,value:pct(done,items.length)};
 });
 return `<div class="card week-progress-card"><div class="row between"><h3>◔ Прогресс недели</h3><span class="muted">${days.reduce((n,d)=>n+d.done,0)}/${days.reduce((n,d)=>n+d.total,0)} ежедневных</span></div>
 <div class="week-chart" role="img" aria-label="Выполнение ежедневных задач по дням недели">${days.map(d=>`<div class="week-chart-col"><b>${d.total?d.value+"%":"—"}</b><div class="week-chart-track"><i style="height:${d.total?Math.max(5,d.value):0}%"></i></div><small>${d.label}</small><span>${d.done}/${d.total}</span></div>`).join("")}</div>
 <div class="week-chart-legend"><span><i></i> Ежедневные задачи</span></div>
 <div class="week-weekly-progress"><div class="row between"><b>Дела на всю неделю</b><strong>${weeklyDoneCount}/${weekly.length} · ${weeklyPct}%</strong></div><div class="progress"><i style="width:${weeklyPct}%"></i></div></div></div>`;
}

function week(v){
 const order=orderedDays(), selectedWeekKey=weekKey(weekOffset), weekly=state.weeklyHabits||[];
 v.innerHTML=section("План недели","Все дни на виду — выбранный день всегда первым ♡")+
 `<div class="weeknav"><button class="ghost" data-week="-1">‹</button><b>${dateFor(0).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${dateFor(6).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</b><button class="ghost" data-week="1">›</button></div>
 <div class="card"><div class="row between"><h3>Порядок дней</h3><span class="muted">Нажми на день</span></div><div class="daygrid">${DAYS.map((d,i)=>`<button class="day ${i===selectedDay?"selected":""}" data-day="${i}">${d}<strong>${dateFor(i).getDate()}</strong></button>`).join("")}</div></div>
 <div class="card"><div class="row between"><h3>✿ Дела на всю неделю</h3><span class="muted">${weekly.filter(x=>weeklyDone(x,selectedWeekKey)).length}/${weekly.length}</span></div>${weekly.map(x=>weeklyHabitRow(x,selectedWeekKey)).join("")||'<div class="empty">Добавь дело на всю неделю ♡</div>'}<button class="primary" data-add="weeklyHabit">＋ Добавить дело на неделю</button></div>
 ${weekTaskChart(selectedWeekKey)}
 <div class="week-stack">${order.map(i=>{const items=dayTasks(i),date=dateKey(dateFor(i)),done=items.filter(t=>taskIsDone(t,date)).length;return `<section class="card week-day-card ${i===selectedDay?"is-selected":""}"><button class="week-day-heading" data-day="${i}"><span><b>${DAYS[i]}</b><small>${FULL[i]}</small></span><span class="muted">${done}/${items.length} выполнено　⌃</span></button>${taskList(items,dateKey(dateFor(i)))}<button class="mini" data-add="task" data-add-day="${dateKey(dateFor(i))}">＋ Добавить задачу</button></section>`;}).join("")}</div>`;
}

function diary(v) {
  const entries = state.diaryEntries || [];
  v.innerHTML = section("Дневник","Мысли, события и маленькие открытия ♡") +
    `<div class="card"><div class="row between"><h3>Мои записи</h3><button class="primary" data-add="diary">＋ Новая запись</button></div>
    ${entries.map(x => `<article class="note-preview"><div class="row between"><b>${escapeHtml(x.title || "Запись")}</b><span class="muted">${new Date(x.createdAt).toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}</span></div><p>${escapeHtml(x.text)}</p><button class="mini icon-edit" data-edit-diary="${x.id}" aria-label="Изменить запись" title="Изменить">✎</button><button class="mini" data-delete-diary="${x.id}">Удалить</button></article>`).join("") || '<div class="empty">Здесь будут храниться твои мысли и воспоминания ♡</div>'}</div>`;
}

function orthodoxEaster(year) {
  const a=year%4,b=year%7,c=year%19,d=(19*c+15)%30,e=(2*a+4*b-d+34)%7;
  const month=Math.floor((d+e+114)/31),day=(d+e+114)%31+1;
  const julian=new Date(year,month-1,day+13,12);
  return dateKey(julian);
}
function holidaysForDate(key) {
  const md=key.slice(5),year=Number(key.slice(0,4)),items=[];
  const ru={"01-01":"Новый год","01-02":"Новогодние каникулы","01-03":"Новогодние каникулы","01-04":"Новогодние каникулы","01-05":"Новогодние каникулы","01-06":"Новогодние каникулы","01-07":"Рождество Христово","01-08":"Новогодние каникулы","02-23":"День защитника Отечества","03-08":"Международный женский день","05-01":"Праздник Весны и Труда","05-09":"День Победы","06-12":"День России","11-04":"День народного единства"};
  if(ru[md])items.push({title:ru[md],source:"Россия"});
  if(md==="05-11")items.push({title:"День Донецкой Народной Республики",source:"ДНР"});
  if(md==="09-30")items.push({title:"День возвращения ДНР в Россию",source:"ДНР"});
  const easter=orthodoxEaster(year);
  if(key===easter)items.push({title:"Светлое Христово Воскресение (Пасха)",source:"ДНР"});
  const trinity=new Date(easter+"T12:00:00");trinity.setDate(trinity.getDate()+49);
  if(key===dateKey(trinity))items.push({title:"День Святой Троицы",source:"ДНР"});
  return items;
}
function unusualHolidayUrl(d) {
  const month=d.toLocaleDateString("en-US",{month:"long"}).toLowerCase();
  return "https://www.daysoftheyear.com/days/"+month+"-"+d.getDate()+"/";
}
function holidayTodayCard() {
  const key=dateKey(today),items=holidaysForDate(key),url=unusualHolidayUrl(today);
  if(items.length)return `<div class="card holiday-card"><h3>🎉 Праздник сегодня</h3>${items.map(x=>`<p><b>${escapeHtml(x.title)}</b><span class="muted"> · ${x.source}</span></p>`).join("")}</div>`;
  return `<div class="card holiday-card"><h3>🎉 Праздник сегодня</h3><p id="unusualHolidayText" class="muted">Ищем необычный праздник дня…</p><a href="${url}" target="_blank" rel="noopener">Посмотреть необычные праздники дня</a></div>`;
}
function fallbackUnusualHoliday(d) {
  const md=dateKey(d).slice(5);
  const list={
    "01-16":"Международный день горячей и острой пищи",
    "02-17":"День спонтанного проявления доброты",
    "03-14":"Международный день числа π",
    "05-25":"День полотенца и День гиков",
    "06-21":"Всемирный день музыки",
    "07-17":"Всемирный день эмодзи",
    "08-19":"Всемирный день фотографии",
    "10-04":"Всемирный день животных",
    "11-19":"Всемирный день туалета и Международный мужской день",
    "12-21":"Всемирный день сноуборда"
  };
  const thirdThursdayNovember=d.getMonth()===10&&d.getDay()===4&&Math.ceil(d.getDate()/7)===3;
  return thirdThursdayNovember?"Всемирный день философии":(list[md]||"");
}
function loadUnusualHoliday() {
  const node=$("#unusualHolidayText");if(!node)return;
  const url=unusualHolidayUrl(today),fallback=fallbackUnusualHoliday(today);
  fetch(url,{mode:"cors"}).then(r=>{if(!r.ok)throw new Error("Holiday page unavailable");return r.text();})
    .then(html=>{const doc=new DOMParser().parseFromString(html,"text/html");const title=doc.querySelector('meta[property="og:title"]')?.content||doc.querySelector("main h1, article h1, h1")?.textContent?.trim();if(title&&title.length<140&&!/days of the year/i.test(title))node.textContent=title;else node.textContent=fallback||"Сегодня можно выбрать необычный праздник на сайте Days of the Year.";})
    .catch(()=>{if(node.isConnected)node.textContent=fallback||"Сегодня необычный праздник можно посмотреть по ссылке ниже ♡";});
}
function calendar(v){
  const month = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const monthName = month.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
  const firstOffset = (month.getDay()+6)%7, daysInMonth = new Date(year,monthIndex+1,0).getDate();
  const cells = Array.from({length:Math.ceil((firstOffset+daysInMonth)/7)*7},(_,i)=>{
    const dayNum=i-firstOffset+1;
    if(dayNum<1 || dayNum>daysInMonth) return '<div class="month-day empty-day"></div>';
    const d=new Date(year,monthIndex,dayNum),key=dateKey(d),entries=(state.calendarEntries||[]).filter(x=>x.date===key);
    const isToday=key===dateKey(today),selected=key===selectedCalendarDate;
    return `<button class="month-day ${isToday?"today":""} ${selected?"selected":""} ${entries.length?"has-events":""}" data-calendar-date="${key}"><span>${dayNum}</span>${entries.length?`<small class="month-day-icons">${entries.slice(0,3).map(x=>({birthday:"🎂",anniversary:"💞",reminder:"✨",appointment:"🩺",holiday:"🎉",trip:"✈️",other:"✨"}[x.kind]||"✨").join(""))}</small>`:""}</button>`;
  }).join("");
  const selected=new Date(selectedCalendarDate+"T12:00:00");
  const selectedLabel=selected.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const entries=(state.calendarEntries||[]).filter(x=>x.date===selectedCalendarDate).sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""));
  const types={birthday:"🎂 Личный праздник",anniversary:"💞 Годовщина",reminder:"📌 Напоминание",appointment:"🩺 Встреча / запись",holiday:"🎉 Праздник",trip:"✈️ Поездка",other:"✿ Другое"};
  const doneTasks=tasksForDate(selectedCalendarDate).filter(t=>taskIsDone(t,selectedCalendarDate));
  const weekDone=(state.weeklyHabits||[]).filter(h=>weeklyDone(h,weekStartKey(selectedCalendarDate)));
  const cycle=state.cycle||{},log=(cycle.logs||{})[selectedCalendarDate]||{};
  const period=(cycle.periods||[]).find(p=>selectedCalendarDate>=p.start&&selectedCalendarDate<=(p.end||p.start));
  const hasCycle=Boolean(period||Object.values(log).some(x=>Array.isArray(x)?x.length:x));
  const painScale={"Нет":0,"Лёгкая":1,"Умеренная":2,"Сильная":3},bleedScale={"Нет":0,"Мажущие":1,"Слабые":2,"Умеренные":3,"Обильные":4};
  const painValue=painScale[log.pain]||0,bleedValue=bleedScale[log.bleeding]||0;
  const cycleCard=hasCycle?`<div class="card"><h3>🌸 Цикл и самочувствие за этот день</h3><div class="day-cycle-graph">${log.pain?`<div><span>Боль</span><i><b style="width:${painValue/3*100}%"></b></i></div>`:""}${log.bleeding?`<div><span>Выделения</span><i><b style="width:${bleedValue/4*100}%"></b></i></div>`:""}</div>${period?`<p><b>Менструация</b> · день ${Math.max(1,Math.floor((new Date(selectedCalendarDate+"T12:00:00")-new Date(period.start+"T12:00:00"))/86400000)+1)}</p>`:""}${log.pain?`<p>Боль: <b>${escapeHtml(log.pain)}</b></p>`:""}${log.bleeding?`<p>Выделения: <b>${escapeHtml(log.bleeding)}</b></p>`:""}${log.mood?`<p>Настроение: <b>${escapeHtml(log.mood)}</b></p>`:""}${log.symptoms?.length?`<p>Симптомы: ${escapeHtml(log.symptoms.join(", "))}</p>`:""}${log.notes?`<p>${escapeHtml(log.notes)}</p>`:""}</div>`:"";
  v.innerHTML=section("Календарь","Месяц целиком — выбирай день и сохраняй важное ♡")+
    `<div class="card month-calendar"><div class="month-head"><button class="ghost" data-month-shift="-1" aria-label="Предыдущий месяц">‹</button><b>${monthName}</b><button class="ghost" data-month-shift="1" aria-label="Следующий месяц">›</button></div>
    <div class="month-grid weekday-labels">${DAYS.map(x=>`<span>${x}</span>`).join("")}</div><div class="month-grid">${cells}</div><div class="month-legend"><span>✨ Личные события</span></div></div>
    <div class="card"><div class="row between"><div><h3>♡ ${selectedLabel}</h3><div class="muted">Сначала твои личные праздники и события</div></div><button class="primary" data-add-calendar="${selectedCalendarDate}">＋ Добавить</button></div>
    ${entries.map(x=>`<article class="calendar-entry ${x.done?"is-done":""}"><div class="row between"><b>${types[x.kind]||types.other}</b><button class="check ${x.done?"on":""}" data-calendar-done="${x.id}">${x.done?"✓":""}</button></div><strong>${escapeHtml(x.title)}</strong>${x.note?`<p>${escapeHtml(x.note)}</p>`:""}<div class="actions"><button class="mini icon-edit" data-edit-calendar="${x.id}" aria-label="Изменить событие" title="Изменить">✎</button><button class="mini" data-delete-calendar="${x.id}">Удалить</button></div></article>`).join("")||'<div class="empty">На этот день нет личных праздников или событий ♡</div>'}</div>
    ${holidayTodayCard()}
    <div class="card"><h3>✓ Выполненные задачи за этот день</h3>${doneTasks.map(t=>`<div class="item done"><span class="itemtext">${escapeHtml(t.title)}</span></div>`).join("")||'<p class="muted">Нет выполненных задач за этот день.</p>'}</div>
    <div class="card"><h3>✿ Выполненные дела на неделю</h3>${weekDone.map(h=>`<div class="item done"><span class="itemtext">${escapeHtml(h.name)}</span></div>`).join("")||'<p class="muted">Нет выполненных дел на этой неделе.</p>'}</div>
    ${cycleCard}`;
  loadUnusualHoliday();
}
function habits(v) {
  const weekly=state.weeklyHabits||[];
  v.innerHTML=section("Задачи","Общий список задач для разделов «Сегодня» и «Неделя» ♡")+
    `<div class="card"><div class="row between"><h3>Мои задачи</h3><button class="primary" data-add="task" data-add-day="${dateKey(today)}">＋ Добавить задачу</button></div>
    ${state.tasks.filter(t=>!t.archived).map(t=>`<div class="item"><span class="itemtext">${escapeHtml(t.title)}</span><button class="mini icon-edit" data-edit-task="${t.id}" aria-label="Изменить задачу" title="Изменить">✎</button></div>`).join("")||'<div class="empty">Добавь первую задачу ♡</div>'}</div>
    <div class="card"><div class="row between"><h3>✿ Дела на неделю</h3><button class="primary" data-add="weeklyHabit">＋ Добавить дело</button></div>
    ${weekly.map(h=>`<div class="item"><span class="itemtext">${escapeHtml(h.name)}</span><button class="mini icon-edit" data-edit-weekly-habit="${h.id}" aria-label="Изменить дело" title="Изменить">✎</button></div>`).join("")||'<div class="empty">Добавь дело, которое нужно выполнить один раз за неделю ♡</div>'}</div>`;
}

function notes(v) {
  const items = state.notes.filter(n => Number(n.day ?? selectedDay) === selectedDay && !n.archived);
  v.innerHTML = section("Заметки","Выбери день — и увидишь его записи") +
    `<div class="card"><h3>День</h3>${dayPicker()}<button class="primary" data-add="note">＋ Новая заметка</button></div>
    ${items.map(n => `<div class="card"><div class="row between"><h3>${escapeHtml(n.title || "Без названия")}</h3><button class="mini icon-edit" data-edit-note="${n.id}" aria-label="Изменить заметку" title="Изменить">✎</button></div><p>${escapeHtml(n.text)}</p><button class="mini" data-delete-note="${n.id}">Удалить</button></div>`).join("") || `<div class="empty">На ${FULL[selectedDay].toLowerCase()} пока нет заметок ♡</div>`}`;
}
function archive(v) {
  v.innerHTML = section("Архив","Завершённые и отложенные задачи") +
    (state.archive.length ? state.archive.map(t => `<div class="card"><div class="itemtext">${escapeHtml(t.title)}</div><button class="mini" data-restore="${t.id}">Вернуть</button><button class="mini" data-delete-archive="${t.id}">Удалить</button></div>`).join("") : `<div class="empty">Архив пока пуст ♡</div>`);
}

function donut(done,total,label) {
  const value = pct(done,total);
  return `<div class="donut-wrap"><div class="donut" style="--donut-value:${value}%"><div class="donut-center"><strong>${value}%</strong><span>${done}/${total}</span></div></div><div>${label}</div></div>`;
}

function stats(v) {
  const tasks = state.tasks.filter(t => !t.archived);
  const currentWeekDates=Array.from({length:7},(_,i)=>{const d=new Date(monday(today));d.setDate(d.getDate()+i);return dateKey(d);});
  const taskDone=tasks.reduce((n,t)=>n+currentWeekDates.filter(d=>taskIsDone(t,d)&& (t.repeatDaily||t.date===d)).length,0);
  const taskTotal=tasks.reduce((n,t)=>n+currentWeekDates.filter(d=>t.repeatDaily||t.date===d).length,0);
  v.innerHTML = section("Мой прогресс","Каждый маленький шаг имеет значение") +
    `<div class="card"><h3>Выполнение задач</h3><div class="progress-charts">${donut(taskDone,taskTotal,"Задачи за неделю")}</div></div>
    
    <div class="card"><div class="row between"><span>Выполнено задач</span><b>${taskDone} из ${taskTotal}</b></div>${progress(pct(taskDone,taskTotal))}</div>`;
}

function openEditor(type,item = {}) {
  editing = {type,id:item.id,day:item.day,date:item.date};
  const form = $("#editForm");
  form.innerHTML = "";
  const fields = {
    task: `<label>Название задачи<input name="title" required value="${escapeHtml(item.title || "")}"></label><label>Дата<input name="date" type="date" required value="${escapeHtml(item.date || dateKey(today))}"></label><label class="editor-repeat"><input name="repeatDaily" type="checkbox" value="yes" ${item.repeatDaily?"checked":""}> Повторять каждый день</label>`,
    weeklyHabit: `<label>Дело на неделю<input name="name" required value="${escapeHtml(item.name || "")}"></label>`,
    note: `<label>Заголовок<input name="title" value="${escapeHtml(item.title || "")}"></label><label>Текст<textarea name="text" rows="5">${escapeHtml(item.text || "")}</textarea></label>`,
    diary: `<label>Заголовок<input name="title" value="${escapeHtml(item.title || "")}"></label><label>Запись<textarea name="text" rows="7" required>${escapeHtml(item.text || "")}</textarea></label>`,
    calendarEntry: `<label>Что отмечаем?<select name="kind">${[["birthday","🎂 День рождения"],["anniversary","💞 Годовщина"],["reminder","📌 Напоминание"],["appointment","🩺 Встреча / запись"],["holiday","🎉 Праздник"],["trip","✈️ Поездка"],["other","✿ Другое"]].map(([v,l])=>`<option value="${v}" ${(item.kind||"reminder")===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Название<input name="title" required maxlength="100" value="${escapeHtml(item.title||"")}"></label><label>Заметка<textarea name="note" rows="4">${escapeHtml(item.note||"")}</textarea></label><label>Дата<input type="date" name="date" required value="${escapeHtml(item.date||selectedCalendarDate)}"></label>`
  };
  const canDelete=Boolean(item.id)&&(type==="task"||type==="weeklyHabit");
  form.innerHTML = (fields[type] || "") + `<div class="form-actions">${canDelete?'<button type="button" class="ghost danger" id="deleteEditing">Удалить</button>':""}<button type="button" class="ghost" id="cancelEdit">Отмена</button><button type="submit" class="primary" id="saveEdit">Сохранить</button></div>`;
  $("#editDialog").showModal();
}

function closeEditor() {
  editing = null;
  const dialog = $("#editDialog");
  if (dialog?.open) dialog.close();
}

function byId(list,id) {
  return list.find(x => String(x.id) === String(id));
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function handleAdd(type,day = selectedDay) {
  if (type === "task") openEditor("task",{date:typeof day==="string"?day:dateKey(dateFor(day))});
  else if (type === "weeklyHabit") openEditor("weeklyHabit");
  else if (type === "note") openEditor("note",{day});
  else if (type === "diary") openEditor("diary");
  else if (type === "calendarEntry") openEditor("calendarEntry",{date:day});
}


document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;

  // Все динамические элементы меню обрабатываются одним делегированным обработчиком.
  if (b.dataset.toggleTab) {
    const id = b.dataset.toggleTab;
    state.hiddenTabs = Array.isArray(state.hiddenTabs) ? state.hiddenTabs : [];
    const shouldHide = !state.hiddenTabs.includes(id);
    state.hiddenTabs = shouldHide
      ? [...state.hiddenTabs, id]
      : state.hiddenTabs.filter(x => x !== id);
    if (shouldHide && tab === id) tab = "home";
    save();
    render();
    return;
  }

  if (b.dataset.theme) {
    state.theme = b.dataset.theme;
    save();
    applyTheme();
    $("#view").querySelectorAll("[data-theme]").forEach(x => x.classList.toggle("active", x.dataset.theme === state.theme));
    return;
  }

  if (b.dataset.goalToggle) { const g=byId(state.goals,b.dataset.goalToggle); if(g){g.done=!g.done;save();render();} return; }
  if (b.dataset.goalDelete) { state.goals=state.goals.filter(x=>String(x.id)!==b.dataset.goalDelete); save(); render(); return; }

  if (b.dataset.tab) {
    tab = b.dataset.tab;
    render();
    return;
  }

  if (b.dataset.go) {
    tab = b.dataset.go;
    render();
    return;
  }

  if (b.dataset.monthShift) { calendarMonthOffset += Number(b.dataset.monthShift); const targetMonth=new Date(today.getFullYear(),today.getMonth()+calendarMonthOffset,1); selectedCalendarDate=dateKey(targetMonth); render(); return; }
  if (b.dataset.calendarDate) { selectedCalendarDate=b.dataset.calendarDate; render(); return; }
  if (b.dataset.addCalendar) { selectedCalendarDate=b.dataset.addCalendar; openEditor("calendarEntry",{date:selectedCalendarDate}); return; }
  if (b.dataset.calendarDone) { const x=byId(state.calendarEntries,b.dataset.calendarDone); if(x){x.done=!x.done;save();render();} return; }
  if (b.dataset.editCalendar) { const x=byId(state.calendarEntries,b.dataset.editCalendar); if(x)openEditor("calendarEntry",x); return; }
  if (b.dataset.deleteCalendar) { state.calendarEntries=state.calendarEntries.filter(x=>String(x.id)!==b.dataset.deleteCalendar); save(); render(); return; }

  if (b.dataset.day !== undefined) {
    selectedDay = Number(b.dataset.day);
    render();
    return;
  }

  if (b.dataset.week) {
    weekOffset += Number(b.dataset.week);
    render();
    return;
  }

  if (b.dataset.add) {
    const addDay=b.dataset.addDay??selectedDay;
    handleAdd(b.dataset.add, /^\d{4}-\d{2}-\d{2}$/.test(String(addDay))?String(addDay):Number(addDay));
    return;
  }

  if (b.id === "cancelEdit") { closeEditor(); return; }
  if (b.id === "deleteEditing" && editing?.id) {
    const {type,id}=editing;
    if (!confirm("Удалить эту запись?")) return;
    if(type==="task") state.tasks=state.tasks.filter(x=>String(x.id)!==String(id));
    if(type==="weeklyHabit") state.weeklyHabits=(state.weeklyHabits||[]).filter(x=>String(x.id)!==String(id));
    save();closeEditor();render();return;
  }

  if (b.dataset.weeklyHabit) {
    const h=byId(state.weeklyHabits,b.dataset.weeklyHabit);
    if(h){
      h.doneWeeks = h.doneWeeks && typeof h.doneWeeks === "object" ? h.doneWeeks : {};
      const key = b.dataset.weekKey || weekKey(0);
      h.doneWeeks[key] = !h.doneWeeks[key];
      save();render();
    }
    return;
  }
  if (b.dataset.editWeeklyHabit) { const h=byId(state.weeklyHabits,b.dataset.editWeeklyHabit); if(h)openEditor("weeklyHabit",h); return; }
  if (b.dataset.task) {
    const t=byId(state.tasks,b.dataset.task),date=b.dataset.taskDate||dateKey(today);
    if(t){t.doneDates=t.doneDates&&typeof t.doneDates==="object"?t.doneDates:{};t.doneDates[date]=!taskIsDone(t,date);save();render();}
    return;
  }

  if (b.dataset.editTask) {
    const t = byId(state.tasks,b.dataset.editTask);
    if (t) openEditor("task",t);
    return;
  }

  if (b.dataset.editDiary) { const n=byId(state.diaryEntries,b.dataset.editDiary); if(n)openEditor("diary",n); return; }
  if (b.dataset.deleteDiary) { state.diaryEntries=state.diaryEntries.filter(x=>String(x.id)!==b.dataset.deleteDiary); save(); render(); return; }

  if (b.dataset.editNote) {
    const n = byId(state.notes,b.dataset.editNote);
    if (n) openEditor("note",n);
    return;
  }

  if (b.dataset.archiveTask) {
    const t = byId(state.tasks,b.dataset.archiveTask);
    if (t) {
      state.tasks = state.tasks.filter(x => x.id !== t.id);
      state.archive.push({...t,archived:true});
      save();
      render();
    }
    return;
  }

  if (b.dataset.deleteWeeklyHabit) { state.weeklyHabits=(state.weeklyHabits||[]).filter(x=>String(x.id)!==b.dataset.deleteWeeklyHabit); save(); render(); return; }

  if (b.dataset.deleteNote) {
    state.notes = state.notes.filter(x => String(x.id) !== b.dataset.deleteNote);
    save();
    render();
    return;
  }

  if (b.dataset.restore) {
    const t = byId(state.archive,b.dataset.restore);
    if (t) {
      state.archive = state.archive.filter(x => x.id !== t.id);
      delete t.archived;
      state.tasks.push(t);
      save();
      render();
    }
    return;
  }

  if (b.dataset.deleteArchive) {
    state.archive = state.archive.filter(x => String(x.id) !== b.dataset.deleteArchive);
    save();
    render();
    return;
  }
});

document.addEventListener("change", e => {
  if (e.target.matches("[data-care-item]")) {
    const day=dateKey(today), idx=Number(e.target.dataset.careItem);
    state.selfCareLog[day]=Array.isArray(state.selfCareLog[day])?state.selfCareLog[day]:[];
    const list=state.selfCareLog[day];
    state.selfCareLog[day]=e.target.checked?[...new Set([...list,idx])]:list.filter(x=>x!==idx);
    save(); render();
  }
});
document.addEventListener("submit", e => {
  if (e.target.id === "moodForm") {
    e.preventDefault(); const f=new FormData(e.target);
    state.moods[dateKey(today)]={mood:f.get("mood"),note:f.get("note")}; save(); render(); return;
  }
  if (e.target.id === "goalForm") {
    e.preventDefault(); const f=new FormData(e.target),title=String(f.get("title")||"").trim();
    if(title){state.goals.push({id:newId(),title,done:false});save();render();} return;
  }
});
document.addEventListener("submit", e => {
  if (e.target.id !== "editForm") return;
  e.preventDefault();

  if (!editing || e.submitter?.id !== "saveEdit") {
    closeEditor();
    return;
  }

  const data = new FormData(e.target);
  const values = Object.fromEntries(data.entries());
  const {type,id} = editing;

  if (type === "task") {
    const date=values.date||dateKey(today),repeatDaily=values.repeatDaily==="yes";
    if(id){const t=byId(state.tasks,id);if(t){t.title=values.title;t.repeatDaily=repeatDaily;if(!repeatDaily)t.date=date;else delete t.date;}}
    else state.tasks.push({id:newId(),title:values.title,date,repeatDaily,doneDates:{}});
  }

  if (type === "weeklyHabit") {
    state.weeklyHabits=Array.isArray(state.weeklyHabits)?state.weeklyHabits:[];
    if(id){const h=byId(state.weeklyHabits,id);if(h)h.name=values.name;}
    else state.weeklyHabits.push({id:newId(),name:values.name,done:false,doneWeeks:{},frequency:"weekly"});
  }

  if (type === "diary") {
    state.diaryEntries=Array.isArray(state.diaryEntries)?state.diaryEntries:[];
    if(id){const entry=byId(state.diaryEntries,id);if(entry)Object.assign(entry,values,{updatedAt:new Date().toISOString()});}
    else state.diaryEntries.unshift({id:newId(),title:values.title,text:values.text,createdAt:new Date().toISOString()});
  }

  if (type === "calendarEntry") {
    state.calendarEntries=Array.isArray(state.calendarEntries)?state.calendarEntries:[];
    if(id){const entry=byId(state.calendarEntries,id);if(entry)Object.assign(entry,values,{updatedAt:new Date().toISOString()});}
    else state.calendarEntries.push({id:newId(),kind:values.kind,title:values.title,note:values.note,date:values.date,done:false,createdAt:new Date().toISOString()});
    selectedCalendarDate=values.date||selectedCalendarDate;
    calendarMonthOffset=(new Date(selectedCalendarDate+"T12:00:00").getFullYear()-today.getFullYear())*12+(new Date(selectedCalendarDate+"T12:00:00").getMonth()-today.getMonth());
  }

  if (type === "note") {
    if (id) {
      const n = byId(state.notes,id);
      if (n) Object.assign(n,values);
    } else {
      state.notes.unshift({
        id:newId(),
        title:values.title,
        text:values.text,
        day:Number(editing.day ?? selectedDay), createdAt:new Date().toISOString()
      });
    }
  }

  save();
  closeEditor();
  render();
});

$("#editDialog")?.addEventListener("close", () => {
  editing = null;
});

$("#quoteBtn")?.addEventListener("click", quote);

$("#quoteBox")?.addEventListener("click", async event => {
  const button = event.target.closest(".quote-copy");
  if (!button) return;
  const text = $("#quoteBox .quote-text")?.textContent || "";
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("Copy command was unavailable");
    }
    button.textContent = "Скопировано ♡";
    button.setAttribute("aria-label", "Цитата скопирована");
  } catch (error) {
    button.textContent = "Не удалось";
    console.warn("Quote copy failed", error);
  }
});

function init() {
  let saved = null;
  try {
    const key = window.plannerCurrentUserId ? "softPlanner:user:" + window.plannerCurrentUserId : "softPlanner";
    saved = localStorage.getItem(key);
  } catch (error) {
    console.warn("Planner local storage could not be read; loading starter data", error);
  }
  if (saved) {
    try {
      state = normalizeState(JSON.parse(saved));
      quote();
      render();
      return Promise.resolve();
    } catch (error) {
      console.warn("Saved planner data could not be parsed; loading starter data", error);
    }
  }
  return fetch("seed.json", { cache: "no-store" })
    .then(r => {
      if (!r.ok) throw new Error("Не удалось загрузить начальные данные планера");
      return r.json();
    })
    .then(data => {
      state = normalizeState(data);
      quote();
      render();
      save();
    })
    .catch(error => {
      console.error("Planner startup fallback", error);
      state = normalizeState({});
      quote();
      render();
      save();
    });
}

$("#settingsBtn")?.addEventListener("click", () => {
  tab = "settings";
  render();
});


window.plannerAppReady = init();

fetch("quotes.json", { cache: "force-cache" })
  .then(response => {
    if (!response.ok) throw new Error("Не удалось загрузить цитаты");
    return response.json();
  })
  .then(data => {
    if (Array.isArray(data)) {
      quoteBank = data;
      quote();
    }
  })
  .catch(error => console.warn("Quote library could not be loaded", error));
