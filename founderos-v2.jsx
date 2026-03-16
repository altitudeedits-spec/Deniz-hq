import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "founderos-v2";
const RANKS = [
  { name: "Bronze", min: 0, color: "#CD7F32" },
  { name: "Silver", min: 7, color: "#C0C0C0" },
  { name: "Gold", min: 14, color: "#FFD700" },
  { name: "Platinum", min: 30, color: "#A8D8EA" },
  { name: "Diamond", min: 60, color: "#B9F2FF" },
];

const LOGO = "data:image/jpeg;base64,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";

const PHOTO = "data:image/jpeg;base64,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";

function getToday() { return new Date().toISOString().split("T")[0]; }
function getDayOfWeek() { return new Date().getDay(); }
function formatTime(m) { const h=Math.floor(m/60), mn=m%60; return h?`${h}h${mn?` ${mn}m`:''}`:m+'m'; }

const I = {
  ig: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>,
  upwork: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4l3-9 3 18 3-9h5"/></svg>,
  dumbbell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4v16M18 4v16M6 12h12M2 8v8M22 8v8"/></svg>,
  target: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  brain: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 5 7v3h4v-3c3-1.5 5-4 5-7a7 7 0 0 0-7-7z"/></svg>,
  video: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.65 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.29 1.54.52 2.35.65a2 2 0 0 1 1.72 2.01z"/></svg>,
  play: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  pause: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  fire: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c-4-2.5-7-6-7-10 0-3 1.5-6 4-8 .5 2 2 3 3 4 1-3 2-6 2-8 3 2 5 5 5 9 0 4-3 7.5-7 10z"/></svg>,
};

const DEFAULT_TASKS = [
  { id:"ig_outreach", label:"Instagram DMs", target:50, unit:"sent", cat:"marketing", icon:I.ig },
  { id:"upwork", label:"Upwork Proposals", target:5, unit:"sent", cat:"marketing", icon:I.upwork },
  { id:"pushups", label:"Pushups", target:200, unit:"reps", cat:"fitness", icon:I.dumbbell },
  { id:"situps", label:"Situps", target:200, unit:"reps", cat:"fitness", icon:I.dumbbell },
  { id:"client_work", label:"Client Delivery", target:120, unit:"min", cat:"business", icon:I.target },
  { id:"ceo_work", label:"CEO Work", target:120, unit:"min", cat:"business", icon:I.brain },
  { id:"content", label:"Content Creation", target:60, unit:"min", cat:"content", icon:I.video },
  { id:"sales_calls", label:"Sales Calls", target:2, unit:"calls", cat:"business", icon:I.phone },
];

const WEEKDAY_SCHED = [
  { time:"07:00", label:"Morning Workout", dur:60 },
  { time:"08:00", label:"Instagram Outreach", dur:60 },
  { time:"09:00", label:"Class", dur:360 },
  { time:"15:00", label:"Sales Calls", dur:60 },
  { time:"16:00", label:"Client Delivery", dur:120 },
  { time:"18:00", label:"CEO Strategy", dur:120 },
  { time:"20:00", label:"Evening Workout", dur:30 },
];

const WEEKEND_SCHEDS = {
  5:[ // Friday
    { time:"07:00", label:"Morning Workout", dur:60 },
    { time:"08:00", label:"Instagram Outreach", dur:60 },
    { time:"09:00", label:"Class", dur:360 },
    { time:"15:00", label:"Content Planning & Script", dur:180 },
    { time:"18:00", label:"CEO Strategy", dur:60 },
    { time:"20:00", label:"Evening Workout", dur:30 },
  ],
  6:[ // Saturday
    { time:"07:00", label:"Morning Workout", dur:60 },
    { time:"08:00", label:"Finish Script", dur:120 },
    { time:"10:00", label:"Record Content", dur:240 },
    { time:"15:00", label:"Client Delivery", dur:120 },
    { time:"18:00", label:"CEO Strategy", dur:60 },
    { time:"20:00", label:"Evening Workout", dur:30 },
  ],
  0:[ // Sunday
    { time:"07:00", label:"Morning Workout", dur:60 },
    { time:"08:00", label:"Edit Content", dur:300 },
    { time:"14:00", label:"CEO Strategy", dur:120 },
    { time:"20:00", label:"Evening Workout", dur:30 },
  ],
};

function getSchedule() {
  const d = getDayOfWeek();
  return WEEKEND_SCHEDS[d] || WEEKDAY_SCHED;
}

function getNowItem(schedule) {
  const now = new Date().getHours();
  return schedule.find(s => { const h=parseInt(s.time); return now>=h && now<h+Math.ceil(s.dur/60); });
}

function getLateItems(schedule, td) {
  const now = new Date().getHours();
  const taskMap = { "Morning Workout":"pushups", "Instagram Outreach":"ig_outreach", "Sales Calls":"sales_calls",
    "Client Delivery":"client_work", "CEO Strategy":"ceo_work", "Content Creation":"content",
    "Evening Workout":"situps", "Content Planning & Script":"content", "Finish Script":"content",
    "Record Content":"content", "Edit Content":"content" };
  return schedule.filter(s => {
    const h = parseInt(s.time);
    const endH = h + Math.ceil(s.dur/60);
    if (now <= endH) return false;
    const tid = taskMap[s.label];
    if (!tid) return false;
    return (td[tid]||0) === 0;
  });
}

const CALL_RESULTS = ["Closed","Not Closed","Rescheduled","Qualified Lead","Unqualified"];

function CallModal({ onLog, onClose }) {
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{background:'#161620',borderRadius:16,padding:24,width:'100%',maxWidth:380,border:'1px solid rgba(255,255,255,0.06)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:16,textAlign:'center'}}>How did the call go?</div>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
          {CALL_RESULTS.map(r => (
            <button key={r} onClick={() => setResult(r)} style={{padding:'10px 14px',background:result===r?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.03)',border:result===r?'1px solid rgba(255,255,255,0.2)':'1px solid rgba(255,255,255,0.06)',borderRadius:8,color:'#fff',fontSize:13,fontWeight:result===r?700:500,cursor:'pointer',textAlign:'left'}}>{r}</button>
          ))}
        </div>
        <textarea placeholder="Notes..." value={notes} onChange={e=>setNotes(e.target.value)}
          style={{width:'100%',padding:10,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,color:'#fff',fontSize:13,minHeight:60,resize:'vertical',outline:'none',boxSizing:'border-box',marginBottom:12}}/>
        <button disabled={!result} onClick={() => result && onLog({result,notes,time:new Date().toLocaleTimeString()})}
          style={{width:'100%',padding:'12px',background:result?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,color:result?'#fff':'rgba(255,255,255,0.2)',fontSize:14,fontWeight:700,cursor:result?'pointer':'default'}}>Save Call</button>
      </div>
    </div>
  );
}

// ===================== FOCUS TIMER =====================
function FocusTimer({ taskId, taskLabel, onComplete }) {
  const [seconds, setSeconds] = useState(15 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const interval = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      interval.current = setInterval(() => setSeconds(s => s - 1), 1000);
    } else {
      clearInterval(interval.current);
      if (seconds === 0 && running) { setRunning(false); setDone(true); }
    }
    return () => clearInterval(interval.current);
  }, [running, seconds]);

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const pct = 1 - seconds / (15 * 60);

  if (done) return (
    <div style={S.focusCard}>
      <div style={S.focusQ}>Did you work fully for 15 minutes?</div>
      <div style={S.focusBtns}>
        <button style={S.focusYes} onClick={() => { onComplete(15); setDone(false); setSeconds(15*60); setRunning(true); }}>Yes — restart</button>
        <button style={S.focusNo} onClick={() => { onComplete(0); setDone(false); setSeconds(15*60); }}>No</button>
        <button style={S.focusDone} onClick={() => { onComplete(15); setDone(false); setSeconds(15*60); }}>Done for now</button>
      </div>
    </div>
  );

  return (
    <div style={S.focusCard}>
      <div style={S.focusLabel}>{taskLabel}</div>
      <div style={S.timerRing}>
        <svg viewBox="0 0 100 100" width="100" height="100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
          <circle cx="50" cy="50" r="44" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${pct*276.5} 276.5`} transform="rotate(-90 50 50)" style={{transition:'stroke-dasharray 1s linear'}}/>
          <text x="50" y="54" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="inherit">{min}:{String(sec).padStart(2,'0')}</text>
        </svg>
      </div>
      <button style={S.focusPlayBtn} onClick={() => setRunning(r => !r)}>
        {running ? I.pause : I.play}
        <span style={{marginLeft:8}}>{running ? 'Pause' : 'Start'}</span>
      </button>
    </div>
  );
}

// ===================== MAIN APP =====================
export default function FounderOS() {
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [focusTask, setFocusTask] = useState(null);
  const [callModal, setCallModal] = useState(false);
  const [calView, setCalView] = useState("week");
  const [calDate, setCalDate] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        setData(r?.value ? JSON.parse(r.value) : { days:{}, ceoLogs:{}, streak:0, rank:0 });
      } catch { setData({ days:{}, ceoLogs:{}, streak:0, rank:0 }); }
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (d) => {
    setData(d);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(d)); } catch {}
  }, []);

  const today = getToday();
  const td = data?.days?.[today] || {};

  const updateTask = useCallback((id, val) => {
    const d = { ...data, days: { ...data.days, [today]: { ...td, [id]: Math.max(0, Number(val)||0) } } };
    const all = DEFAULT_TASKS.every(t => (d.days[today][t.id]||0) >= t.target);
    if (all && !d.days[today]._done) { d.days[today]._done=true; d.streak=(d.streak||0)+1;
      const nr = RANKS.findIndex((r,i)=>i>(d.rank||0)&&d.streak>=r.min);
      if(nr>0) d.rank=nr;
    }
    save(d);
  }, [data, today, td, save]);

  const logCall = useCallback((callData) => {
    const d = { ...data };
    if (!d.callLogs) d.callLogs = {};
    if (!d.callLogs[today]) d.callLogs[today] = [];
    d.callLogs[today].push(callData);
    d.days = { ...d.days, [today]: { ...td, sales_calls: (td.sales_calls||0)+1 } };
    save(d);
    setCallModal(false);
  }, [data, today, td, save]);

  if (!loaded) return <div style={S.app}><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'rgba(255,255,255,0.3)',fontSize:14,letterSpacing:2}}>LOADING</div></div>;

  const allTasks = DEFAULT_TASKS;
  const progress = allTasks.reduce((s,t) => s + Math.min((td[t.id]||0)/t.target,1), 0) / allTasks.length;
  const rank = RANKS[data?.rank||0];
  const schedule = getSchedule();

  const tabs = [
    { id:"home", label:"Home" },
    { id:"calendar", label:"Calendar" },
    { id:"tasks", label:"Tasks" },
    { id:"stats", label:"Stats" },
  ];

  const nowItem = getNowItem(schedule);
  const lateItems = getLateItems(schedule, td);

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={S.header}>
        <img src={LOGO} alt="Deniz Funnels" style={S.logo} />
        <div style={S.headerRight}>
          <div style={S.streakBadge}>{I.fire}<span style={{marginLeft:4,fontWeight:700}}>{data?.streak||0}</span></div>
          <img src={PHOTO} alt="" style={S.avatar} />
        </div>
      </div>

      {/* CONTENT */}
      <div style={S.content}>
        {callModal && <CallModal onLog={logCall} onClose={() => setCallModal(false)} />}

        {tab === "home" && (
          <>
            {/* NOW section */}
            {nowItem && (
              <div style={S.nowCard}>
                <div style={S.nowLabel}>NOW</div>
                <div style={S.nowName}>{nowItem.label}</div>
                <div style={S.nowDur}>{formatTime(nowItem.dur)}</div>
              </div>
            )}

            {/* LATE alerts */}
            {lateItems.length > 0 && (
              <div style={S.lateCard}>
                <div style={S.lateLabel}>OVERDUE</div>
                {lateItems.map((l,i) => (
                  <div key={i} style={S.lateItem}>{l.label}</div>
                ))}
              </div>
            )}

            {/* Progress */}
            <div style={S.progressSection}>
              <div style={S.progressRing}>
                <svg viewBox="0 0 120 120" width="100" height="100">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
                  <circle cx="60" cy="60" r="52" fill="none" stroke={progress>=1?"#4ADE80":"#fff"} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${progress*326.7} 326.7`} transform="rotate(-90 60 60)" style={{transition:'stroke-dasharray 0.6s'}}/>
                  <text x="60" y="64" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="800" fontFamily="inherit">{Math.round(progress*100)}%</text>
                </svg>
              </div>
              <div style={S.progressMeta}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4}}>Today's execution</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.5)'}}>Rank: <span style={{color:rank.color,fontWeight:700}}>{rank.name}</span></div>
              </div>
            </div>

            {/* Focus Timer */}
            {focusTask ? (
              <FocusTimer taskId={focusTask.id} taskLabel={focusTask.label}
                onComplete={(mins) => { if(mins>0) updateTask(focusTask.id, (td[focusTask.id]||0)+mins); setFocusTask(null); }} />
            ) : null}

            {/* Task Cards */}
            <div style={S.section}>
              {allTasks.map(t => {
                const v = td[t.id]||0, pct = Math.min(v/t.target,1), done = pct>=1;
                return (
                  <div key={t.id} style={{...S.taskRow, ...(done?S.taskRowDone:{})}}>
                    <div style={S.taskLeft}>
                      <div style={S.taskIcon}>{t.icon}</div>
                      <div>
                        <div style={S.taskName}>{t.label}</div>
                        <div style={S.taskSub}>{v} / {t.target} {t.unit}</div>
                      </div>
                    </div>
                    <div style={S.taskRight}>
                      {done ? <span style={S.taskCheck}>{I.check}</span> : (
                        <div style={S.taskBtns}>
                          {t.unit==='min' ? (
                            <button style={S.startBtn} onClick={() => setFocusTask(t)}>Start</button>
                          ) : (
                            <>
                              <button style={S.qBtn} onClick={() => updateTask(t.id, v+(t.unit==='reps'?25:1))}>+{t.unit==='reps'?25:1}</button>
                              <button style={S.qBtnDone} onClick={() => updateTask(t.id, t.target)}>{I.check}</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={S.taskBar}><div style={{...S.taskBarFill, width:`${pct*100}%`, background:done?'#4ADE80':'#fff'}}/></div>
                  </div>
                );
              })}
            </div>

            {/* Schedule */}
            <div style={{...S.sectionLabel,marginTop:24}}>Schedule</div>
            {schedule.map((s,i) => {
              const h = parseInt(s.time);
              const now = new Date().getHours();
              const active = now>=h && now<h+Math.ceil(s.dur/60);
              return (
                <div key={i} style={{...S.schedRow, ...(active?S.schedActive:{})}}>
                  <div style={S.schedTime}>{s.time}</div>
                  <div style={S.schedName}>{s.label}</div>
                  <div style={S.schedDur}>{formatTime(s.dur)}</div>
                </div>
              );
            })}
            <div style={{fontSize:11,color:'rgba(255,255,255,0.25)',marginTop:12,lineHeight:1.5}}>
              Google Calendar / Calendly calls will sync here when backend is connected.
            </div>

            {/* Log Call Button */}
            <button style={S.logCallBtn} onClick={() => setCallModal(true)}>
              {I.phone} <span style={{marginLeft:8}}>Log Sales Call</span>
            </button>

            {/* Today's Calls */}
            {(data?.callLogs?.[today]||[]).length > 0 && (
              <div style={{marginTop:12}}>
                <div style={S.sectionLabel}>Call Log</div>
                {data.callLogs[today].map((c,i) => (
                  <div key={i} style={S.callLogRow}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:13,fontWeight:600,color:c.result==='Closed'?'#4ADE80':c.result==='Not Closed'?'#EF4444':'rgba(255,255,255,0.7)'}}>{c.result}</span>
                      <span style={{fontSize:11,color:'rgba(255,255,255,0.25)'}}>{c.time}</span>
                    </div>
                    {c.notes && <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:4}}>{c.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "calendar" && (() => {
          const weekDates = Array.from({length:7},(_,i)=>{
            const d=new Date(calDate); const day=d.getDay();
            const mon=new Date(d); mon.setDate(d.getDate()-((day+6)%7));
            const curr=new Date(mon); curr.setDate(mon.getDate()+i);
            return curr;
          });
          const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          return (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={S.sectionLabel}>Calendar</div>
                <div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.03)',borderRadius:8,padding:2}}>
                  <button onClick={()=>setCalView("week")} style={{...S.toggleBtn,...(calView==="week"?S.toggleActive:{})}}>Week</button>
                  <button onClick={()=>setCalView("day")} style={{...S.toggleBtn,...(calView==="day"?S.toggleActive:{})}}>Day</button>
                </div>
              </div>

              {calView==="week" && (
                <div style={{display:'flex',gap:4,marginBottom:16}}>
                  {weekDates.map((d,i)=>{
                    const key=d.toISOString().split("T")[0];
                    const isToday=key===getToday();
                    const sel=key===calDate.toISOString().split("T")[0];
                    const dayData=data?.days?.[key];
                    const done=dayData?._done;
                    return (
                      <button key={i} onClick={()=>setCalDate(d)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'6px 0',borderRadius:8,background:sel?'rgba(255,255,255,0.06)':'transparent',border:isToday?'1px solid rgba(255,255,255,0.15)':'1px solid transparent',cursor:'pointer',color:'#fff'}}>
                        <span style={{fontSize:9,fontWeight:600,color:'rgba(255,255,255,0.3)'}}>{DAYS[d.getDay()]}</span>
                        <span style={{fontSize:14,fontWeight:700}}>{d.getDate()}</span>
                        {done && <span style={{width:5,height:5,borderRadius:'50%',background:'#4ADE80'}}/>}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={S.sectionLabel}>{calDate.toISOString().split("T")[0]===getToday() ? "Today's Schedule" : `${DAYS[calDate.getDay()]} Schedule`}</div>
              {(WEEKEND_SCHEDS[calDate.getDay()] || WEEKDAY_SCHED).map((s,i)=>(
                <div key={i} style={S.schedRow}>
                  <div style={S.schedTime}>{s.time}</div>
                  <div style={S.schedName}>{s.label}</div>
                  <div style={S.schedDur}>{formatTime(s.dur)}</div>
                </div>
              ))}

              {data?.days?.[calDate.toISOString().split("T")[0]] && (
                <>
                  <div style={{...S.sectionLabel,marginTop:16}}>Activity</div>
                  {DEFAULT_TASKS.map(t=>{
                    const v=data.days[calDate.toISOString().split("T")[0]]?.[t.id]||0;
                    if(!v) return null;
                    return <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.03)',fontSize:13}}><span>{t.label}</span><span style={{fontWeight:700}}>{v}/{t.target}</span></div>;
                  })}
                </>
              )}
            </>
          );
        })()}

        {tab === "tasks" && (
          <>
            <div style={S.sectionLabel}>Execution Checklist</div>
            {allTasks.map(t => {
              const v = td[t.id]||0, done = v>=t.target;
              return (
                <div key={t.id} style={{...S.checkRow, ...(done?S.checkDone:{})}}>
                  <div style={S.checkLeft}>
                    <div style={{...S.checkBox, ...(done?S.checkBoxDone:{})}} onClick={() => updateTask(t.id, done?0:t.target)}>
                      {done && I.check}
                    </div>
                    <div>
                      <div style={S.checkLabel}>{t.icon} {t.label}</div>
                      <div style={S.checkTarget}>Target: {t.target} {t.unit}</div>
                    </div>
                  </div>
                  <input type="number" style={S.checkInput} value={v||''} placeholder="0"
                    onChange={e => updateTask(t.id, e.target.value)} />
                </div>
              );
            })}
          </>
        )}

        {tab === "stats" && (
          <>
            <div style={S.sectionLabel}>7-Day Overview</div>
            {allTasks.slice(0,6).map(t => {
              const hist = Array.from({length:7},(_,i) => {
                const d = new Date(); d.setDate(d.getDate()-6+i);
                return data?.days?.[d.toISOString().split("T")[0]]?.[t.id]||0;
              });
              const mx = Math.max(...hist,1);
              return (
                <div key={t.id} style={S.chartCard}>
                  <div style={S.chartHead}><span>{t.label}</span><span style={{color:'rgba(255,255,255,0.3)'}}>{hist.reduce((a,b)=>a+b,0)} total</span></div>
                  <div style={S.miniChart}>
                    {hist.map((v,i) => (
                      <div key={i} style={S.barCol}>
                        <div style={{...S.bar, height:`${(v/mx)*100}%`, background:v>=t.target?'#4ADE80':'#fff'}}/>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div style={{height:80}}/>
      </div>

      {/* NAV */}
      <nav style={S.nav}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{...S.navBtn, ...(tab===t.id?S.navActive:{})}}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ===================== STYLES =====================
const S = {
  app: { fontFamily:"'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif", background:"#0A0A0F", color:"#F0F0F5", minHeight:"100vh", maxWidth:480, margin:"0 auto", position:"relative" },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' },
  logo: { height:24, objectFit:'contain' },
  headerRight: { display:'flex', alignItems:'center', gap:12 },
  streakBadge: { display:'flex', alignItems:'center', background:'rgba(255,255,255,0.04)', borderRadius:20, padding:'4px 12px', fontSize:13, color:'#F59E0B' },
  avatar: { width:32, height:32, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,0.1)' },
  content: { padding:'16px 16px 0', paddingBottom:90 },
  nav: { position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, display:'flex', background:'rgba(10,10,15,0.97)', borderTop:'1px solid rgba(255,255,255,0.05)', backdropFilter:'blur(20px)', zIndex:100, padding:'10px 0 env(safe-area-inset-bottom,10px)' },
  navBtn: { flex:1, background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:12, fontWeight:600, letterSpacing:0.5, cursor:'pointer', padding:'6px 0', textTransform:'uppercase' },
  navActive: { color:'#fff' },

  progressSection: { display:'flex', alignItems:'center', gap:20, marginBottom:24 },
  progressRing: {},
  progressMeta: {},

  section: { display:'flex', flexDirection:'column', gap:1 },
  sectionLabel: { fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.25)', marginBottom:12 },

  taskRow: { display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', position:'relative' },
  taskRowDone: { opacity:0.5 },
  taskLeft: { display:'flex', alignItems:'center', gap:12 },
  taskIcon: { color:'rgba(255,255,255,0.4)' },
  taskName: { fontSize:14, fontWeight:600 },
  taskSub: { fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:1 },
  taskRight: {},
  taskCheck: { color:'#4ADE80' },
  taskBtns: { display:'flex', gap:6 },
  qBtn: { padding:'6px 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:600, cursor:'pointer' },
  qBtnDone: { padding:'6px 10px', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.15)', borderRadius:6, color:'#4ADE80', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center' },
  startBtn: { padding:'6px 16px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:0.5 },
  taskBar: { width:'100%', height:2, background:'rgba(255,255,255,0.04)', borderRadius:1, marginTop:6 },
  taskBarFill: { height:'100%', borderRadius:1, transition:'width 0.4s ease' },

  focusCard: { background:'rgba(255,255,255,0.03)', borderRadius:16, padding:24, textAlign:'center', marginBottom:24, border:'1px solid rgba(255,255,255,0.06)' },
  focusLabel: { fontSize:13, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'rgba(255,255,255,0.4)', marginBottom:16 },
  timerRing: { display:'flex', justifyContent:'center', marginBottom:16 },
  focusPlayBtn: { display:'inline-flex', alignItems:'center', padding:'10px 24px', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' },
  focusQ: { fontSize:15, fontWeight:700, marginBottom:16 },
  focusBtns: { display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' },
  focusYes: { padding:'10px 20px', background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:10, color:'#4ADE80', fontSize:13, fontWeight:700, cursor:'pointer' },
  focusNo: { padding:'10px 20px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, color:'#EF4444', fontSize:13, fontWeight:600, cursor:'pointer' },
  focusDone: { padding:'10px 20px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'rgba(255,255,255,0.5)', fontSize:13, fontWeight:600, cursor:'pointer' },

  schedRow: { display:'flex', alignItems:'center', gap:16, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' },
  schedActive: { background:'rgba(255,255,255,0.04)', margin:'0 -16px', padding:'10px 16px', borderRadius:10, borderBottom:'none' },
  schedTime: { fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.3)', minWidth:44 },
  schedName: { fontSize:13, fontWeight:600, flex:1 },
  schedDur: { fontSize:11, color:'rgba(255,255,255,0.25)' },

  checkRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' },
  checkDone: { opacity:0.45 },
  checkLeft: { display:'flex', alignItems:'center', gap:12 },
  checkBox: { width:24, height:24, borderRadius:6, border:'2px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:12, fontWeight:800 },
  checkBoxDone: { background:'#4ADE80', borderColor:'#4ADE80', color:'#0A0A0F' },
  checkLabel: { fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 },
  checkTarget: { fontSize:11, color:'rgba(255,255,255,0.25)' },
  checkInput: { width:56, padding:'6px 8px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6, color:'#fff', fontSize:16, fontWeight:700, textAlign:'right', outline:'none' },

  chartCard: { background:'rgba(255,255,255,0.02)', borderRadius:12, padding:14, marginBottom:8, border:'1px solid rgba(255,255,255,0.04)' },
  chartHead: { display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600, marginBottom:10 },
  miniChart: { display:'flex', gap:3, height:40, alignItems:'flex-end' },
  barCol: { flex:1, height:'100%', display:'flex', alignItems:'flex-end' },
  bar: { width:'100%', minHeight:2, borderRadius:2, transition:'height 0.4s', opacity:0.7 },

  nowCard: { background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'14px 16px', marginBottom:12, border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:12 },
  nowLabel: { fontSize:9, fontWeight:800, letterSpacing:2, color:'#4ADE80', background:'rgba(74,222,128,0.1)', padding:'3px 8px', borderRadius:4 },
  nowName: { fontSize:14, fontWeight:700, flex:1 },
  nowDur: { fontSize:11, color:'rgba(255,255,255,0.3)' },

  lateCard: { background:'rgba(239,68,68,0.06)', borderRadius:12, padding:'12px 16px', marginBottom:12, border:'1px solid rgba(239,68,68,0.12)' },
  lateLabel: { fontSize:9, fontWeight:800, letterSpacing:2, color:'#EF4444', marginBottom:6 },
  lateItem: { fontSize:13, color:'rgba(239,68,68,0.8)', padding:'3px 0' },

  logCallBtn: { display:'flex', alignItems:'center', justifyContent:'center', width:'100%', padding:'12px', marginTop:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, color:'rgba(255,255,255,0.5)', fontSize:13, fontWeight:600, cursor:'pointer' },
  callLogRow: { padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' },

  toggleBtn: { padding:'5px 12px', background:'none', border:'none', borderRadius:6, color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:600, cursor:'pointer' },
  toggleActive: { background:'rgba(255,255,255,0.08)', color:'#fff' },
};
