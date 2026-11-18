(() => {
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)};
const date=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)};
const plus=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return key(d)};
const diff=(a,b)=>Math.round((date(b)-date(a))/86400000);
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(date(s).getTime())&&key(date(s))===s;
const today=key(new Date());
const cdata=()=>{state.cycle=state.cycle||{periods:[],logs:{},customSymptoms:[],forecastOverride:""};let c=state.cycle;c.periods=Array.isArray(c.periods)?c.periods:[];c.logs=c.logs||{};c.customSymptoms=c.customSymptoms||[];return c};
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;
const intervals=c=>{const p=c.periods.slice().sort((a,b)=>a.start.localeCompare(b.start));return p.slice(1).map((x,i)=>diff(p[i].start,x.start)).filter(n=>n>=15&&n<=60)};
const prediction=c=>{const p=c.periods.slice().sort((a,b)=>a.start.localeCompare(b.start));return c.forecastOverride|| (p.length?plus(p[p.length-1].start,avg(intervals(c))||28):"")};
const select=(n,l,opts,val)=>'<label>'+l+'<select name="'+n+'"><option value="">Не отмечено</option>'+opts.map(x=>'<option '+(x===val?'selected':'')+'>'+x+'</option>').join("")+'</select></label>';
let monthOffset=0,selectedCycleId="";
function monthCalendar(c){
 const now=new Date(),base=new Date(now.getFullYear(),now.getMonth()+monthOffset,1,12),year=base.getFullYear(),month=base.getMonth();
 const first=(base.getDay()+6)%7,days=new Date(year,month+1,0).getDate(),cells=Math.ceil((first+days)/7)*7;
 const periods=c.periods.slice().sort((a,b)=>a.start.localeCompare(b.start));
 const latest=periods[periods.length-1];
 const forecast=prediction(c); const bleedLen=latest&&latest.end?Math.max(1,Math.min(10,diff(latest.start,latest.end)+1)):5;
 const actualDays=new Set(); periods.forEach(p=>{if(!p.end){actualDays.add(p.start);return;}for(let d=p.start;d<=p.end;d=plus(d,1))actualDays.add(d);});
 const forecastDays=new Set(); if(forecast){for(let i=0;i<bleedLen;i++)forecastDays.add(plus(forecast,i));}
 const labels=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
 let html='<div class="card cycle-card"><div class="cycle-month-head"><button class="ghost" type="button" data-cycle-month="-1">‹</button><b class="cycle-month-title">'+esc(base.toLocaleDateString("ru-RU",{month:"long",year:"numeric"}))+'</b><button class="ghost" type="button" data-cycle-month="1">›</button></div><div class="cycle-month-grid">'+labels.map(x=>'<div class="cycle-weekday">'+x+'</div>').join("");
 for(let i=0;i<cells;i++){const n=i-first+1,d=new Date(year,month,n,12),k=key(d),outside=d.getMonth()!==month,classes=['cycle-date'];if(outside)classes.push('outside');if(k===today)classes.push('today');if(actualDays.has(k))classes.push('actual');else if(forecastDays.has(k))classes.push('forecast');html+='<button type="button" class="'+classes.join(' ')+'" data-cycle-day="'+k+'" aria-label="Открыть записи за '+k+'">'+d.getDate()+'</button>';}
 html+='</div><div class="cycle-legend"><span><i class="cycle-dot"></i> Менструация</span><span><i class="cycle-dot forecast"></i> Плановые дни</span></div><p class="muted">Плановые даты рассчитаны приблизительно по истории цикла. Их можно скорректировать ниже.</p></div>';
 return html;
}

function cycleCharts(c,period,end){
 const entries=Object.keys(c.logs||{}).filter(d=>d>=period.start&&d<=end).sort();
 const defs=[
  ["Боль","pain",{"Нет":0,"Лёгкая":1,"Умеренная":2,"Сильная":3},3],
  ["Объём выделений","bleeding",{"Нет":0,"Мажущие":1,"Слабые":2,"Умеренные":3,"Обильные":4},4],
  ["Настроение","mood",{"Грустное":0,"Тревожное":1,"Раздражительное":2,"Нейтральное":3,"Хорошее":4,"Отличное":5},5],
  ["Энергия","energy",{"Очень низкая":0,"Низкая":1,"Средняя":2,"Высокая":3},3],
  ["Сон","sleep",{"Плохой":0,"Средний":1,"Хороший":2,"Отличный":3},3],
  ["Аппетит","appetite",{"Сниженный":0,"Обычный":1,"Повышенный":2},2]
 ];
 const chart=(title,field,map,max)=>{const rows=entries.filter(d=>c.logs[d]&&c.logs[d][field]).map(d=>({d,v:c.logs[d][field],n:map[c.logs[d][field]]})).filter(x=>Number.isFinite(x.n));return '<div class="cycle-chart"><b>'+title+'</b>'+(rows.length?'<div class="cycle-chart-bars">'+rows.map(x=>'<button type="button" class="cycle-chart-bar" data-cycle-day="'+x.d+'" title="'+x.d+': '+esc(x.v)+'"><i style="height:'+Math.max(8,(x.n+1)/(max+1)*100)+'%"></i><small>'+x.d.slice(8,10)+'.'+x.d.slice(5,7)+'</small></button>').join('')+'</div>':'<p class="muted">Нет отметок за этот цикл</p>')+'</div>';};
 let html='<div class="card cycle-card cycle-history-charts"><h3>Самочувствие за цикл</h3><p class="muted">'+esc(period.start)+' — '+esc(end)+' · '+entries.length+' дней с записями</p>';
 defs.forEach(d=>html+=chart(d[0],d[1],d[2],d[3]));
 const symptomRows=entries.filter(d=>(c.logs[d].symptoms||[]).length).map(d=>({d,n:c.logs[d].symptoms.length,v:c.logs[d].symptoms.join(', ')}));
 html+='<div class="cycle-chart"><b>Количество симптомов</b>'+(symptomRows.length?'<div class="cycle-chart-bars">'+symptomRows.map(x=>'<button type="button" class="cycle-chart-bar" data-cycle-day="'+x.d+'" title="'+x.d+': '+esc(x.v)+'"><i style="height:'+Math.max(8,x.n/Math.max(1,...symptomRows.map(y=>y.n))*100)+'%"></i><small>'+x.d.slice(8,10)+'.'+x.d.slice(5,7)+'</small></button>').join('')+'</div>':'<p class="muted">Нет отмеченных симптомов</p>')+'</div>';
 html+='</div>';return html;
}
function cycleTab(v){
 const c=cdata(),p=c.periods.slice().sort((a,b)=>b.start.localeCompare(a.start)),next=prediction(c),a=avg(intervals(c)),day=window.cycleLogDay||today,log=c.logs[day]||{};
 const symptoms=[...new Set(["Спазмы","Головная боль","Вздутие","Акне","Чувствительность груди","Тошнота","Усталость",...c.customSymptoms])];
 const ordered=c.periods.slice().sort((x,y)=>x.start.localeCompare(y.start));
 if(!selectedCycleId||!ordered.some(x=>x.id===selectedCycleId))selectedCycleId=ordered.length?ordered[ordered.length-1].id:"";
 const selected=ordered.find(x=>x.id===selectedCycleId);
 const nextPeriod=selected?ordered.find(x=>x.start>selected.start):null;
 const cycleEnd=selected?(selected.end|| (nextPeriod?plus(nextPeriod.start,-1):today)):today;
 const historyCharts=selected?cycleCharts(c,selected,cycleEnd):"";
 v.innerHTML=section("Женские дни","Бережное наблюдение за циклом ♡")+monthCalendar(c)+
 '<div class="card cycle-card"><h3>Следующая менструация</h3><div class="cycle-forecast"><strong>'+(next?esc(date(next).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})):"Пока нет прогноза")+'</strong><span>Приблизительная дата, не медицинское заключение</span></div><label>Исправить прогноз<input id="cycleForecast" type="date" value="'+esc(next)+'"></label><button class="ghost" data-cycle-forecast>Сохранить дату</button></div>'+
 '<div class="card cycle-card"><h3>История цикла</h3><form id="periodForm" class="cycle-form"><label>Первый день<input name="start" type="date" required></label><label>Последний день<input name="end" type="date"></label><button class="primary">＋ Сохранить даты</button></form><div class="cycle-stats"><div><b>'+(a?a+" дн.":"—")+'</b><span>средняя длина цикла</span></div><div><b>'+p.length+'</b><span>записей в истории</span></div></div>'+
 (p.length?'<h3>Прошлые циклы</h3>'+p.map(x=>'<div class="item"><span class="itemtext">'+esc(x.start)+'<small>'+(x.end?' — '+esc(x.end):'')+'</small></span><button class="mini" data-period-view="'+esc(x.id)+'">'+(x.id===selectedCycleId?'Выбран':'Графики')+'</button><button class="mini" data-period-edit="'+esc(x.id)+'">Изменить</button><button class="mini" data-period-delete="'+esc(x.id)+'">×</button></div>').join(""):'<div class="empty">Здесь появится история ♡</div>')+
 historyCharts+(next?'<button class="primary" data-cycle-new>Начался новый цикл?</button>':'')+'</div>'+
 '<div class="card cycle-card"><h3>Ежедневное самочувствие</h3><label>Дата<input id="cycleLogDate" type="date" value="'+esc(day)+'"></label><form id="cycleLogForm">'+
 select("pain","Боль",["Нет","Лёгкая","Умеренная","Сильная"],log.pain)+select("bleeding","Объём выделений",["Нет","Мажущие","Слабые","Умеренные","Обильные"],log.bleeding)+select("mood","Настроение",["Отличное","Хорошее","Нейтральное","Грустное","Тревожное","Раздражительное"],log.mood)+select("energy","Энергия",["Очень низкая","Низкая","Средняя","Высокая"],log.energy)+select("sleep","Сон",["Плохой","Средний","Хороший","Отличный"],log.sleep)+select("appetite","Аппетит",["Сниженный","Обычный","Повышенный"],log.appetite)+
 '<fieldset><legend>Симптомы</legend><div class="cycle-symptoms">'+symptoms.map(s=>'<label><input type="checkbox" name="symptoms" value="'+esc(s)+'" '+((log.symptoms||[]).includes(s)?'checked':'')+'> '+esc(s)+'</label>').join("")+'</div></fieldset><label>Добавить свой симптом<input id="customSymptom" placeholder="Например, чувствительность к запахам"></label><button type="button" class="ghost" data-cycle-add>Добавить симптом</button><label>Лекарства / контрацепция (необязательно)<input name="medication" value="'+esc(log.medication||"")+'"></label><label>Заметки<textarea name="notes" rows="3">'+esc(log.notes||"")+'</textarea></label><button class="primary">Сохранить наблюдение</button></form></div>';
}
window.cycleTab=cycleTab;window.cycleLogDay=today;
document.addEventListener("change",e=>{if(e.target.id==="cycleLogDate"){window.cycleLogDay=e.target.value;cycleTab(document.querySelector("#view"));}});
document.addEventListener("submit",e=>{
 if(e.target.id==="periodForm"){e.preventDefault();const c=cdata(),f=new FormData(e.target),start=f.get("start"),end=f.get("end");if(!validDate(start)|| (end&&!validDate(end)))return alert("Проверь дату начала и окончания.");if(end&&end<start)return alert("Дата окончания раньше начала.");if(c.periods.some(x=>x.start===start))return alert("Такая дата начала уже есть в истории.");c.periods.push({id:Date.now().toString(36),start,end:end||""});c.forecastOverride="";save();cycleTab($("#view"));}
 if(e.target.id==="cycleLogForm"){e.preventDefault();const c=cdata(),f=new FormData(e.target);c.logs[window.cycleLogDay]={pain:f.get("pain"),bleeding:f.get("bleeding"),mood:f.get("mood"),energy:f.get("energy"),sleep:f.get("sleep"),appetite:f.get("appetite"),symptoms:f.getAll("symptoms"),medication:f.get("medication"),notes:f.get("notes")};save();cycleTab($("#view"));}
});
document.addEventListener("click",e=>{
 const dayCell=e.target.closest("[data-cycle-day]");
 if(dayCell){window.cycleLogDay=dayCell.dataset.cycleDay;cycleTab($("#view"));return;}
 const b=e.target.closest("button");if(!b)return;const c=cdata();
 if(b.hasAttribute("data-period-view")){selectedCycleId=b.dataset.periodView;const chosen=c.periods.find(x=>x.id===selectedCycleId);if(chosen)window.cycleLogDay=chosen.start;cycleTab($("#view"));return;}
 if(b.hasAttribute("data-cycle-month")){monthOffset+=Number(b.dataset.cycleMonth)||0;cycleTab($("#view"));return;}
 if(b.hasAttribute("data-cycle-forecast")){const v=$("#cycleForecast").value;if(v&&!validDate(v))return alert("Укажи корректную дату прогноза.");c.forecastOverride=v;save();cycleTab($("#view"));}
 if(b.hasAttribute("data-cycle-new")&&confirm("Отметить сегодня как начало нового цикла?")){if(c.periods.some(x=>x.start===today))return alert("Сегодняшняя дата уже записана в истории.");c.periods.push({id:Date.now().toString(36),start:today,end:""});c.forecastOverride="";save();cycleTab($("#view"));}
 if(b.hasAttribute("data-period-delete")&&confirm("Удалить запись из истории?")){c.periods=c.periods.filter(x=>x.id!==b.dataset.periodDelete);save();cycleTab($("#view"));}
 if(b.hasAttribute("data-period-edit")){const p=c.periods.find(x=>x.id===b.dataset.periodEdit);if(!p)return;const s=prompt("Дата начала (ГГГГ-ММ-ДД)",p.start);if(s===null)return;const end=prompt("Последний день (можно пусто)",p.end||"");if(end===null)return;if(!validDate(s)||(end&&!validDate(end)))return alert("Проверь формат дат: ГГГГ-ММ-ДД.");if(end&&end<s)return alert("Дата окончания раньше начала.");if(c.periods.some(x=>x.id!==p.id&&x.start===s))return alert("Такая дата начала уже есть в истории.");p.start=s;p.end=end;c.forecastOverride="";save();cycleTab($("#view"));}
 if(b.hasAttribute("data-cycle-add")){const i=$("#customSymptom"),s=i.value.trim();if(s&&!c.customSymptoms.includes(s)){c.customSymptoms.push(s);save();cycleTab($("#view"));}}
});
})();