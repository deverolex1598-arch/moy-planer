const DAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const FULL = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let state, tab = "home", selectedDay = (new Date().getDay() + 6) % 7, weekOffset = 0, editing = null;

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
  s.notes = Array.isArray(s.notes) ? s.notes : [];
  s.archive = Array.isArray(s.archive) ? s.archive : [];
  s.quotes = Array.isArray(s.quotes) ? s.quotes : [];
  s.theme = s.theme || "pink";
  s.reminder = s.reminder || "20:00";
  s.reminderEnabled = Boolean(s.reminderEnabled);
  s.dailyHabits.forEach(h => {
    if (!Array.isArray(h.done)) h.done = Array(7).fill(false);
    while (h.done.length < 7) h.done.push(false);
  });
  return s;
}

function save() {
  const userId = window.plannerCurrentUserId;
  const key = userId ? "softPlanner:user:" + userId : "softPlanner";
  localStorage.setItem(key, JSON.stringify(state));
  if (userId && typeof window.plannerCloudSave === "function") window.plannerCloudSave(state);
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

function quote() {
  const quotes = Array.isArray(state?.quotes) ? state.quotes : [];
  const q = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : "";
  const box = $("#quoteBox");
  if (box) box.textContent = q || "Маленькие шаги тоже важны ♡";
}

function applyTheme() {
  document.body.className = state.theme === "pink" ? "" : "theme-" + state.theme;
}

function dayTasks(day) {
  return state.tasks.filter(t => t.day === day && !t.archived);
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
  $$("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  let v = $("#view");
  ({home, week, calendar, habits, notes, archive, stats, cycle: window.cycleTab, more}[tab] || home)(v);
}

function section(title, sub = "") {
  return `<div class="row between"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div></div>`;
}

function progress(n) {
  return `<div class="progress"><i style="width:${Math.max(0,Math.min(100,n))}%"></i></div>`;
}

function home(v) {
 const td=(today.getDay()+6)%7, h=state.dailyHabits.filter(x=>x.done[td]).length, total=state.dailyHabits.length;
 const ns=state.notes.filter(n=>Number(n.day??td)===td&&!n.archived), wh=state.weeklyHabits||[];
 v.innerHTML=section("Главная","Твоё уютное пространство ♡")+
 `<div class="card home-progress"><div class="row between"><div><div class="muted">Привычки сегодня</div><div class="big">${h} из ${total}</div><div class="soft-caption">Маленькие шаги тоже важны ♡</div></div>${donut(h,total,"выполнено сегодня")}</div></div>
 <div class="card"><div class="row between"><h3>♡ Мои привычки на сегодня</h3><button class="mini" data-go="habits">Все привычки</button></div>${state.dailyHabits.map(x=>habitRow(x,td)).join("")||'<div class="empty">Добавь первую привычку ♡</div>'}</div>
 <div class="card weekly-home"><div class="row between"><h3>✿ Дела на неделю</h3><button class="mini" data-go="habits">Изменить</button></div>
 ${wh.map(x=>`<div class="item ${x.done?"done":""}"><button class="check ${x.done?"on":""}" data-weekly-habit="${x.id}">${x.done?"✓":""}</button><span class="itemtext">${escapeHtml(x.name)}</span><button class="mini" data-edit-weekly-habit="${x.id}">✎</button></div>`).join("")||'<div class="empty">Добавь одно дело на всю неделю ♡</div>'}
 <button class="primary" data-add="weeklyHabit">＋ Добавить дело на неделю</button></div>
 <div class="card"><div class="row between"><div><h3>✎ Заметка на сегодня</h3><div class="muted">${today.toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</div></div><button class="mini" data-add="note" data-add-day="${td}">＋ Добавить заметку</button></div>
 ${ns.map(n=>`<div class="note-preview"><b>${escapeHtml(n.title||"Заметка")}</b><p>${escapeHtml(n.text)}</p><button class="mini" data-edit-note="${n.id}">Изменить</button></div>`).join("")||'<div class="empty">Пусть здесь появится что-то хорошее ♡</div>'}</div>
 <div class="quick-add"><button class="ghost" data-add="task">＋ Задача</button><button class="ghost" data-add="habit">＋ Привычка</button></div>`;
}


function more(v) {
  v.innerHTML = section("Ещё","Дополнительные разделы твоего планера ♡") +
    `<div class="card more-links"><button class="ghost" data-go="habits">♡ Привычки и дела на неделю</button><button class="ghost" data-go="notes">✎ Заметки</button><button class="ghost" data-go="archive">▣ Архив</button><button class="ghost" data-go="stats">◔ Прогресс</button></div>`;
}

function dayPicker() {
  return `<div class="daygrid">${DAYS.map


((d,i) =>
    `<button class="day ${i===selectedDay?"selected":""} ${dayTasks(i).length?"has":""}" data-day="${i}">${d}<strong>${dateFor(i).getDate()}</strong></button>`
  ).join("")}</div>`;
}

function habitRow(h,day) {
  return `<div class="item"><button class="check ${h.done[day]?"on":""}" data-habit="${h.id}" data-day="${day}">${h.done[day]?"✓":""}</button><span class="itemtext">${escapeHtml(h.name)}</span><button class="mini" data-edit-habit="${h.id}">⋯</button></div>`;
}

function taskList(items) {
  return items.length ? items.map(t =>
    `<div class="item ${t.done?"done":""}"><button class="check ${t.done?"on":""}" data-task="${t.id}">${t.done?"✓":""}</button><span class="itemtext">${escapeHtml(t.title)}</span><button class="mini" data-edit-task="${t.id}">✎</button><button class="mini" data-archive-task="${t.id}">▣</button></div>`
  ).join("") : `<div class="empty">Пока нет задач. Добавь первую ♡</div>`;
}

function orderedDays(){return Array.from({length:7},(_,k)=>(selectedDay+k)%7);}
function week(v){
 const order=orderedDays();
 v.innerHTML=section("План недели","Все дни на виду — выбранный день всегда первым ♡")+
 `<div class="weeknav"><button class="ghost" data-week="-1">‹</button><b>${dateFor(0).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${dateFor(6).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</b><button class="ghost" data-week="1">›</button></div>
 <div class="card"><div class="row between"><h3>Порядок дней</h3><span class="muted">Нажми на день</span></div><div class="daygrid">${DAYS.map((d,i)=>`<button class="day ${i===selectedDay?"selected":""}" data-day="${i}">${d}<strong>${dateFor(i).getDate()}</strong></button>`).join("")}</div></div>
 <div class="week-stack">${order.map(i=>{const items=dayTasks(i),done=items.filter(t=>t.done).length;return `<section class="card week-day-card ${i===selectedDay?"is-selected":""}"><button class="week-day-heading" data-day="${i}"><span><b>${DAYS[i]}</b><small>${FULL[i]}</small></span><span class="muted">${done}/${items.length} выполнено　⌃</span></button>${taskList(items)}<button class="mini" data-add="task" data-add-day="${i}">＋ Добавить задачу</button></section>`;}).join("")}</div>`;
}
function calendar(v){
 const items=dayTasks(selectedDay),td=(today.getDay()+6)%7,ns=state.notes.filter(n=>Number(n.day??selectedDay)===selectedDay&&!n.archived),wh=state.weeklyHabits||[];
 v.innerHTML=section("Календарь","Нажми на день, чтобы посмотреть всё самое важное")+
 `<div class="card"><div class="weeknav"><button class="ghost" data-week="-1">‹</button><b>${dateFor(0).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${dateFor(6).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</b><button class="ghost" data-week="1">›</button></div>${dayPicker()}</div>
 <div class="card"><div class="row between"><div><h3>♡ ${FULL[selectedDay]}</h3><div class="muted">${dateFor(selectedDay).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</div></div><span class="pill">${selectedDay===td?"Сегодня":"Выбранный день"}</span></div>
 <h3>Планы</h3>${taskList(items)}<h3>Привычки</h3>${state.dailyHabits.map(h=>habitRow(h,selectedDay)).join("")||'<div class="empty">Нет привычек</div>'}
 <h3>Дела на неделю</h3>${wh.map(x=>`<div class="item"><span class="itemtext">${escapeHtml(x.name)}</span><span class="pill">${x.done?"Выполнено":"В планах"}</span></div>`).join("")||'<div class="empty">Нет недельных дел</div>'}
 <h3>Заметки</h3>${ns.map(n=>`<div class="note-preview"><b>${escapeHtml(n.title||"Заметка")}</b><p>${escapeHtml(n.text)}</p></div>`).join("")||'<div class="empty">Заметок пока нет</div>'}
 <button class="primary" data-add="task" data-add-day="${selectedDay}">＋ Добавить план</button></div>`;
}

function habits(v) {
  const weekly=state.weeklyHabits||[];
  v.innerHTML=section("Мои привычки","Ежедневные ритуалы и дела на всю неделю ♡")+
    `<div class="card"><div class="row between"><h3>♡ Ежедневные привычки</h3><button class="primary" data-add="habit">＋ Добавить</button></div>
    ${state.dailyHabits.map(h=>`<div class="item"><span class="itemtext">${escapeHtml(h.name)}</span><button class="mini" data-edit-habit="${h.id}">✎</button><button class="mini" data-delete-habit="${h.id}">×</button></div>`).join("")||'<div class="empty">Добавь первую привычку ♡</div>'}</div>
    <div class="card"><div class="row between"><h3>✿ Дела на неделю</h3><button class="primary" data-add="weeklyHabit">＋ Добавить</button></div>
    ${weekly.map(h=>`<div class="item ${h.done?"done":""}"><button class="check ${h.done?"on":""}" data-weekly-habit="${h.id}">${h.done?"✓":""}</button><span class="itemtext">${escapeHtml(h.name)}</span><button class="mini" data-edit-weekly-habit="${h.id}">✎</button><button class="mini" data-delete-weekly-habit="${h.id}">×</button></div>`).join("")||'<div class="empty">Добавь дело, которое нужно выполнить один раз за неделю ♡</div>'}</div>
    <div class="card"><h3>Отметки ежедневных привычек</h3>${state.dailyHabits.map(h=>`<div class="habitweek"><b>${escapeHtml(h.name)}</b><div class="habitdays">${DAYS.map((d,i)=>`<button class="check ${h.done[i]?"on":""}" data-habit="${h.id}" data-day="${i}">${h.done[i]?"✓":d[0]}</button>`).join("")}</div></div>`).join("")}</div>`;
}

function notes(v) {
  const items = state.notes.filter(n => Number(n.day ?? selectedDay) === selectedDay && !n.archived);
  v.innerHTML = section("Заметки","Выбери день — и увидишь его записи") +
    `<div class="card"><h3>День</h3>${dayPicker()}<button class="primary" data-add="note">＋ Новая заметка</button></div>
    ${items.map(n => `<div class="card"><div class="row between"><h3>${escapeHtml(n.title || "Без названия")}</h3><button class="mini" data-edit-note="${n.id}">✎</button></div><p>${escapeHtml(n.text)}</p><button class="mini" data-delete-note="${n.id}">Удалить</button></div>`).join("") || `<div class="empty">На ${FULL[selectedDay].toLowerCase()} пока нет заметок ♡</div>`}`;
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
  const taskDone = tasks.filter(t => t.done).length;
  const habitTotal = state.dailyHabits.length * 7;
  const habitDone = state.dailyHabits.reduce((n,h) => n + h.done.filter(Boolean).length,0);
  v.innerHTML = section("Мой прогресс","Каждый маленький шаг имеет значение") +
    `<div class="card"><h3>Выполнение задач</h3><div class="progress-charts">${donut(taskDone,tasks.length,"Задачи")}</div></div>
    <div class="card"><h3>Привычки за неделю</h3><div class="progress-charts">${donut(habitDone,habitTotal,"Привычки")}</div></div>
    <div class="card"><div class="row between"><span>Выполнено задач</span><b>${taskDone} из ${tasks.length}</b></div>${progress(pct(taskDone,tasks.length))}</div>`;
}

function openEditor(type,item = {}) {
  editing = {type,id:item.id,day:item.day};
  const form = $("#editForm");
  form.innerHTML = "";
  const fields = {
    task: `<label>Название задачи<input name="title" required value="${escapeHtml(item.title || "")}"></label><label>День<select name="day">${DAYS.map((d,i) => `<option value="${i}" ${Number(item.day ?? selectedDay)===i?"selected":""}>${d}</option>`).join("")}</select></label>`,
    habit: `<label>Название привычки<input name="name" required value="${escapeHtml(item.name || "")}"></label>`,
    weeklyHabit: `<label>Дело на неделю<input name="name" required value="${escapeHtml(item.name || "")}"></label>`,
    note: `<label>Заголовок<input name="title" value="${escapeHtml(item.title || "")}"></label><label>Текст<textarea name="text" rows="5">${escapeHtml(item.text || "")}</textarea></label>`
  };
  form.innerHTML = (fields[type] || "") + `<div class="form-actions"><button type="button" class="ghost" id="cancelEdit">Отмена</button><button type="submit" class="primary" id="saveEdit">Сохранить</button></div>`;
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
  if (type === "task") openEditor("task",{day});
  else if (type === "habit") openEditor("habit");
  else if (type === "weeklyHabit") openEditor("weeklyHabit");
  else if (type === "note") openEditor("note",{day});
}


document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;

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
    handleAdd(b.dataset.add, Number(b.dataset.addDay ?? selectedDay));
    return;
  }

  if (b.id === "cancelEdit") {
    closeEditor();
    return;
  }

  if (b.dataset.weeklyHabit) { const h=byId(state.weeklyHabits,b.dataset.weeklyHabit); if(h){h.done=!h.done;save();render();} return; }
  if (b.dataset.editWeeklyHabit) { const h=byId(state.weeklyHabits,b.dataset.editWeeklyHabit); if(h)openEditor("weeklyHabit",h); return; }
  if (b.dataset.habit) {
    const h = byId(state.dailyHabits,b.dataset.habit);
    const day = Number(b.dataset.day ?? selectedDay);
    if (h) {
      h.done[day] = !h.done[day];
      save();
      render();
    }
    return;
  }

  if (b.dataset.task) {
    const t = byId(state.tasks,b.dataset.task);
    if (t) {
      t.done = !t.done;
      save();
      render();
    }
    return;
  }

  if (b.dataset.editTask) {
    const t = byId(state.tasks,b.dataset.editTask);
    if (t) openEditor("task",t);
    return;
  }

  if (b.dataset.editHabit) {
    const h = byId(state.dailyHabits,b.dataset.editHabit);
    if (h) openEditor("habit",h);
    return;
  }

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
  if (b.dataset.deleteHabit) {
    state.dailyHabits = state.dailyHabits.filter(x => String(x.id) !== b.dataset.deleteHabit);
    save();
    render();
    return;
  }

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
    if (id) {
      const t = byId(state.tasks,id);
      if (t) Object.assign(t,values,{day:Number(values.day)});
    } else {
      state.tasks.push({
        id:newId(),
        title:values.title,
        day:Number(values.day),
        done:false
      });
    }
  }

  if (type === "weeklyHabit") {
    state.weeklyHabits=Array.isArray(state.weeklyHabits)?state.weeklyHabits:[];
    if(id){const h=byId(state.weeklyHabits,id);if(h)h.name=values.name;}
    else state.weeklyHabits.push({id:newId(),name:values.name,done:false,frequency:"weekly"});
  }

  if (type === "habit") {
    if (id) {
      const h = byId(state.dailyHabits,id);
      if (h) h.name = values.name;
    } else {
      state.dailyHabits.push({
        id:newId(),
        name:values.name,
        done:Array(7).fill(false)
      });
    }
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

function init() {
  const saved = localStorage.getItem(window.plannerCurrentUserId ? "softPlanner:user:" + window.plannerCurrentUserId : "softPlanner");
  if (saved) {
    try {
      state = normalizeState(JSON.parse(saved));
      quote();
    } catch (e) {
      state = normalizeState({});
    }
    render();
    return Promise.resolve();
  }
  return fetch("seed.json")
    .then(r => r.ok ? r.json() : {})
    .then(data => {
      state = normalizeState(data);
      quote();
      save();
      render();
    })
    .catch(() => {
      state = normalizeState({});
      quote();
      save();
      render();
    });
}

$("#settingsBtn")?.addEventListener("click", () => {
  tab = "settings";
  const themes = ["pink","beige","green","lavender","dark"];
  const labels = ["Розовая","Бежевая","Зелёная","Лавандовая","Тёмная"];
  $("#view").innerHTML = section("Настройки","Выбери оформление планера") +
    `<div class="card"><h3>Темы</h3><div class="theme-options">${themes.map((t,i) => `<button class="theme-choice ${state.theme===t?"active":""}" data-theme="${t}">${labels[i]}</button>`).join("")}</div></div>`;
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-theme]");
  if (!b) return;
  state.theme = b.dataset.theme;
  save();
  applyTheme();
  $("#view").querySelectorAll("[data-theme]").forEach(x => x.classList.toggle("active",x.dataset.theme === state.theme));
});

window.plannerAppReady = init();
