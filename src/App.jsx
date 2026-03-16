import { useState, useEffect, useCallback, useRef } from "react";
import {
  supabase, getDeviceId,
  loadData, saveTaskValue, saveDayDone, saveStreak, logCallToSupabase,
  saveCustomSchedule, saveRevenue, saveWorkLog, saveDailyReview,
  readLocalState, writeLocalState, updateCallLogsForDate,
  saveMonthlyRevenueGoal, deleteCustomSchedule,
} from "./lib/supabase.js";
import {
  initNotifications, scheduleAggressiveNotifications,
  getNotificationPayload, BADGE_URL, ICON_URL,
} from "./lib/notifications.js";
import {
  connectGoogleCalendar, disconnectGoogleCalendar,
  getStoredGcalToken, restoreGcalToken, getCachedGcalEvents,
  fetchCalendarEvents, eventToScheduleBlock,
  getGcalEventsForDate, getAllGcalEventsByDate,
  saveGcalEventClassification, getGcalEventClassification,
} from "./lib/googleCalendar.js";
import { getProductivityBreakdown, getSalesFunnel, getDateRangeKeys as getStatsDateRange, getTotalProductiveMinutes } from "./lib/stats.js";
import "./App.css";

const _ls = readLocalState();

// ─── Constants ────────────────────────────────────────────────────────────────
const RANKS = [
  { name: "Bronze",   min: 0,  color: "#CD7F32" },
  { name: "Silver",   min: 7,  color: "#C0C0C0" },
  { name: "Gold",     min: 14, color: "#FFD700" },
  { name: "Platinum", min: 30, color: "#A8D8EA" },
  { name: "Diamond",  min: 60, color: "#B9F2FF" },
];
const LOGO       = "/LOGO app.png";
const PHOTO      = "/Profile pic.png";
const NOTIF_ICON = "/NEW Notification icon.png";

function getToday() { return new Date().toISOString().split("T")[0]; }
function dateStr(d) { return d.toISOString().split("T")[0]; }
function prevDay(ds) { const d = new Date(ds + "T12:00:00"); d.setDate(d.getDate() - 1); return dateStr(d); }
function formatTime(m) { const h = Math.floor(m / 60), mn = m % 60; return h ? `${h}h${mn ? ` ${mn}m` : ""}` : m + "m"; }
function formatMin(m) { if (!m) return "0m"; const h = Math.floor(m/60), mn = m%60; return h ? `${h}h${mn?` ${mn}m`:""}` : `${m}m`; }

// ─── Icons ────────────────────────────────────────────────────────────────────
const I = {
  ig:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>,
  upwork:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4l3-9 3 18 3-9h5"/></svg>,
  dumbbell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4v16M18 4v16M6 12h12M2 8v8M22 8v8"/></svg>,
  target:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  brain:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 5 7v3h4v-3c3-1.5 5-4 5-7a7 7 0 0 0-7-7z"/></svg>,
  video:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  phone:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.65 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.29 1.54.52 2.35.65a2 2 0 0 1 1.72 2.01z"/></svg>,
  play:     <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  pause:    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  fire:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c-4-2.5-7-6-7-10 0-3 1.5-6 4-8 .5 2 2 3 3 4 1-3 2-6 2-8 3 2 5 5 5 9 0 4-3 7.5-7 10z"/></svg>,
  fireLg:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c-4-2.5-7-6-7-10 0-3 1.5-6 4-8 .5 2 2 3 3 4 1-3 2-6 2-8 3 2 5 5 5 9 0 4-3 7.5-7 10z"/></svg>,
  pencil:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  plus:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  x:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  bell:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  chevL:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>,
  chevR:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>,
  star:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  lightning:<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  chart:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
};

// ─── Task definitions ─────────────────────────────────────────────────────────
const DEFAULT_TASKS = [
  { id: "ig_outreach", label: "Instagram DMs",    target: 50,  unit: "sent",  cat: "marketing", icon: I.ig },
  { id: "upwork",      label: "Upwork Proposals",  target: 5,   unit: "sent",  cat: "marketing", icon: I.upwork },
  { id: "pushups",     label: "Pushups",            target: 200, unit: "reps",  cat: "fitness",   icon: I.dumbbell },
  { id: "situps",      label: "Situps",             target: 200, unit: "reps",  cat: "fitness",   icon: I.dumbbell },
  { id: "client_work", label: "Client Delivery",   target: 120, unit: "min",   cat: "business",  icon: I.target },
  { id: "ceo_work",    label: "CEO Work",           target: 120, unit: "min",   cat: "business",  icon: I.brain },
  { id: "content",     label: "Content Creation",  target: 60,  unit: "min",   cat: "content",   icon: I.video },
  { id: "sales_calls", label: "Sales Calls",        target: 2,   unit: "calls", cat: "business",  icon: I.phone },
];
const TASK_BY_ID = Object.fromEntries(DEFAULT_TASKS.map(t => [t.id, t]));

// ─── Default schedules ────────────────────────────────────────────────────────
const WEEKDAY_SCHED = [
  { time: "07:00", label: "Morning Workout",    dur: 60  },
  { time: "08:00", label: "Instagram Outreach", dur: 60  },
  { time: "09:00", label: "Class",              dur: 360 },
  { time: "16:00", label: "Client Delivery",    dur: 120 },
  { time: "18:00", label: "CEO Strategy",       dur: 120 },
  { time: "20:00", label: "Evening Workout",    dur: 30  },
];
const WEEKEND_SCHEDS = {
  5: [ { time:"07:00",label:"Morning Workout",dur:60},{time:"08:00",label:"Instagram Outreach",dur:60},{time:"09:00",label:"Class",dur:360},{time:"15:00",label:"Content Planning & Script",dur:180},{time:"18:00",label:"CEO Strategy",dur:60},{time:"20:00",label:"Evening Workout",dur:30} ],
  6: [ { time:"07:00",label:"Morning Workout",dur:60},{time:"08:00",label:"Finish Script",dur:120},{time:"10:00",label:"Record Content",dur:240},{time:"15:00",label:"Client Delivery",dur:120},{time:"18:00",label:"CEO Strategy",dur:60},{time:"20:00",label:"Evening Workout",dur:30} ],
  0: [ { time:"07:00",label:"Morning Workout",dur:60},{time:"08:00",label:"Edit Content",dur:300},{time:"14:00",label:"CEO Strategy",dur:120},{time:"20:00",label:"Evening Workout",dur:30} ],
};
const SCHED_TASK_MAP = {
  "Morning Workout":"pushups","Instagram Outreach":"ig_outreach","Sales Calls":"sales_calls",
  "Client Delivery":"client_work","CEO Strategy":"ceo_work","Content Creation":"content",
  "Evening Workout":"situps","Content Planning & Script":"content","Finish Script":"content",
  "Record Content":"content","Edit Content":"content",
};

function getTodaysTasks(schedule, tasksById = TASK_BY_ID) {
  const seen = new Set();
  const result = [];
  for (const s of schedule) {
    const tid = s.taskId || SCHED_TASK_MAP[s.label];
    if (tid) {
      if (seen.has(tid)) continue;
      seen.add(tid);
      const base = tasksById[tid];
      if (base) result.push({
        ...base,
        label: s.label || base.label,
        target: s.target != null ? s.target : base.target,
        unit: s.unit || base.unit,
      });
    } else if (s.customType === "counter" && s.target != null) {
      // Fully custom counter block with no linked DEFAULT_TASK
      const blockId = s.blockId || ("block_" + s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
      if (seen.has(blockId)) continue;
      seen.add(blockId);
      result.push({
        id: blockId,
        label: s.label,
        target: Number(s.target),
        unit: s.unit || "reps",
        cat: s.category || "custom",
        icon: null,
      });
    } else if (s.customType === "timer") {
      // Custom timer block — tracked via work logs like any timer task
      const timerBlockId = s.blockId || ("timer_" + s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
      if (seen.has(timerBlockId)) continue;
      seen.add(timerBlockId);
      result.push({
        id: timerBlockId,
        label: s.label,
        target: s.dur,       // duration in minutes is the target
        unit: "min",
        cat: s.category || "Other",
        icon: null,
      });
    }
  }
  return result;
}

function getScheduleForDate(ds, customSchedules = {}) {
  if (customSchedules[ds]) return customSchedules[ds];
  const d = new Date(ds + "T12:00:00"), dow = d.getDay();
  return WEEKEND_SCHEDS[dow] || WEEKDAY_SCHED;
}
function getSchedStatus(s, td) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const start = parseInt(s.time) * 60, end = start + s.dur;
  const tid = s.taskId || SCHED_TASK_MAP[s.label] || s.blockId;
  if (tid) {
    const val = td[tid] || 0;
    // target: explicit block override > TASK_BY_ID default > null (timer: any val > 0 = done)
    const target = s.target != null ? Number(s.target) : (TASK_BY_ID[tid]?.target ?? null);
    const isDone = target != null ? val >= target : val > 0;
    if (isDone) return "done";
  }
  if (nowMin >= start && nowMin < end) return "now";
  if (tid && nowMin >= end) return "missed";
  return "upcoming";
}
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning, Deniz" : h < 17 ? "Good afternoon, Deniz" : "Good evening, Deniz";
}
function getContextualMsg(schedule, td, todayTasks) {
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  if (now.getHours() >= 21) {
    const done = todayTasks.filter(t => (td[t.id] || 0) >= t.target).length;
    return `You completed ${done} of ${todayTasks.length} tasks today`;
  }
  for (const s of schedule) {
    const start = parseInt(s.time) * 60, end = start + s.dur;
    if (nowMin >= start && nowMin < end) return `${s.label} — ${formatTime(end - nowMin)} remaining`;
  }
  const missed = schedule.filter(s => {
    const end = parseInt(s.time) * 60 + s.dur; if (nowMin < end) return false;
    const tid = s.taskId || SCHED_TASK_MAP[s.label]; return tid && (td[tid] || 0) === 0;
  }).length;
  if (missed > 0) return `${missed} task${missed !== 1 ? "s" : ""} need your attention`;
  const next = schedule.find(s => parseInt(s.time) * 60 > nowMin);
  if (next) return `Next: ${next.label} at ${next.time}`;
  return "Stay focused and execute.";
}

// ─── Category / Productivity helpers ─────────────────────────────────────────
const CAT_TASK_MAP = {
  "Fitness":            ["pushups","situps"],
  "Client Acquisition": ["ig_outreach","upwork","sales_calls","content"],
  "Client Fulfilment":  ["client_work"],
  "Offer Refinement":   ["ceo_work"],
};
const CAT_LABEL_MAP = {
  "Morning Workout":"Fitness","Evening Workout":"Fitness",
  "Instagram Outreach":"Client Acquisition","Content Planning & Script":"Client Acquisition",
  "Finish Script":"Client Acquisition","Record Content":"Client Acquisition",
  "Edit Content":"Client Acquisition","Sales Calls":"Client Acquisition","Upwork Proposals":"Client Acquisition",
  "Client Delivery":"Client Fulfilment","CEO Strategy":"Offer Refinement",
};
const CAT_COLORS = { "Fitness":"#4ADE80","Client Acquisition":"#60A5FA","Client Fulfilment":"#A78BFA","Offer Refinement":"#FBBF24" };

function getTaskCategory(taskId, label) {
  for (const [cat, ids] of Object.entries(CAT_TASK_MAP)) {
    if (ids.includes(taskId)) return cat;
  }
  return CAT_LABEL_MAP[label] || "Other";
}

function getDateRangeKeys(period, today) {
  const days = [];
  const now = new Date(today + "T12:00:00");
  if (period === "today") {
    days.push(today);
  } else if (period === "week") {
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(dateStr(d)); }
  } else if (period === "month") {
    const [y, m] = today.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) days.push(`${y}-${String(m).padStart(2,"0")}-${String(i).padStart(2,"0")}`);
  } else { // alltime
    const allKeys = new Set();
    // we'll compute from outside — just return null marker
    return null;
  }
  return days;
}

function computeProductivity(workLogs, days, period, today, allKeys, callLogs) {
  const range = period === "alltime" ? allKeys : getDateRangeKeys(period, today);
  const byCategory = {};
  const dateSet = range ? new Set(range) : null;

  // Work logs (timer sessions, manual entries, extra work)
  for (const [date, logs] of Object.entries(workLogs || {})) {
    if (dateSet && !dateSet.has(date)) continue;
    for (const l of logs) {
      let cat = l.category || getTaskCategory(l.taskId, l.taskId);
      if (l.taskId === "_extra" && l.category) cat = l.category;
      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat] += l.minutes || 0;
    }
  }

  // Call durations: sales/rescheduled → Client Acquisition, client → Client Fulfilment
  for (const [date, logs] of Object.entries(callLogs || {})) {
    if (dateSet && !dateSet.has(date)) continue;
    for (const l of logs) {
      const mins = Number(l.duration_minutes) || 0;
      if (!mins) continue;
      const type = (l.call_type || "sales").toLowerCase();
      const cat = type === "client" ? "Client Fulfilment" : "Client Acquisition";
      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat] += mins;
    }
  }

  return byCategory;
}

function DonutChart({ data, size = 140 }) {
  const entries = Object.entries(data).filter(([,v]) => v > 0);
  const total = entries.reduce((s, [,v]) => s + v, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>No data</span></div>;
  const r = size / 2 - 12;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = entries.map(([cat, mins]) => {
    const pct = mins / total;
    const dashLen = pct * circumference;
    const seg = { cat, mins, pct, dash: dashLen, offset };
    offset += dashLen;
    return seg;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14"/>
      {segments.map(s => (
        <circle key={s.cat} cx={cx} cy={cy} r={r} fill="none"
          stroke={CAT_COLORS[s.cat] || "#888"} strokeWidth="14" strokeLinecap="butt"
          strokeDasharray={`${s.dash} ${circumference}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}/>
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800" fontFamily="inherit">
        {Math.round(total / 60)}h
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="inherit">
        total
      </text>
    </svg>
  );
}

// ─── Analytics helpers ────────────────────────────────────────────────────────
function computeTaskStreaks(days) {
  const result = {};
  for (const task of DEFAULT_TASKS) {
    let streak = 0;
    const d = new Date(); d.setDate(d.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const ds = dateStr(d);
      if ((days[ds]?.[task.id] || 0) >= task.target) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    result[task.id] = streak;
  }
  return result;
}

function computeMonthlyRevenue(callLogs) {
  const mp = new Date().toISOString().slice(0, 7);
  let total = 0;
  for (const [date, logs] of Object.entries(callLogs || {})) {
    if (!date.startsWith(mp)) continue;
    for (const l of logs) if (l.result === "Closed") total += Number(l.value_eur) || 0;
  }
  return total;
}

function getWhatShouldIDo(schedule, td, workLogs, today, todayTasks) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const current = schedule.find(s => { const st = parseInt(s.time)*60; return nowMin >= st && nowMin < st + s.dur; });
  const next = schedule.find(s => parseInt(s.time) * 60 > nowMin);
  const minsToNext = next ? parseInt(next.time) * 60 - nowMin : null;
  const todayLogs = workLogs?.[today] || [];

  if (current) {
    const tid = current.taskId || SCHED_TASK_MAP[current.label] || current.blockId;
    const task = tid ? todayTasks.find(t => t.id === tid) : null;
    if (task) {
      const val = td[tid] || 0;
      if (task.unit === "min") {
        const logged = todayLogs.filter(l => l.taskId === tid).reduce((s, l) => s + l.minutes, 0);
        const rem = task.target - logged;
        if (rem > 0) return `It's ${task.label} time. You've logged ${formatMin(logged)} of ${formatMin(task.target)}. Start a focus block now.`;
        return `${task.label} target hit. Stay on task.`;
      }
      const rem = task.target - val;
      if (rem > 0) return `You're in ${task.label}. ${rem} more ${task.unit} to target. Stop reading this and start.`;
    }
    return `You're in your ${current.label} block. Focus up and execute.`;
  }

  if (next && minsToNext && minsToNext <= 30) {
    const tid = next.taskId || SCHED_TASK_MAP[next.label] || next.blockId;
    const task = tid ? todayTasks.find(t => t.id === tid) : null;
    if (task && task.unit !== "min") {
      const rem = task.target - (td[tid] || 0);
      if (rem > 0) return `${minsToNext} min before ${task.label}. You need ${rem} more ${task.unit} to hit target. Use this gap.`;
    }
    return `${next.label} starts in ${minsToNext} min. Wrap up and prepare.`;
  }

  const behind = todayTasks.filter(t => (td[t.id] || 0) < t.target)
    .sort((a, b) => {
      const sa = schedule.find(s => (s.taskId || SCHED_TASK_MAP[s.label]) === a.id);
      const sb = schedule.find(s => (s.taskId || SCHED_TASK_MAP[s.label]) === b.id);
      return (sa ? parseInt(sa.time)*60 + sa.dur : 9999) - (sb ? parseInt(sb.time)*60 + sb.dur : 9999);
    });

  if (behind.length > 0) {
    const t = behind[0];
    const val = td[t.id] || 0;
    if (t.unit === "min") {
      const logged = todayLogs.filter(l => l.taskId === t.id).reduce((s, l) => s + l.minutes, 0);
      return `${t.label}: ${formatMin(logged)}/${formatMin(t.target)} logged. Start a focus block.`;
    }
    return `${t.label}: ${val}/${t.target} ${t.unit}. ${t.target - val} to go — do it now.`;
  }
  return "You're on track. Stay consistent. Don't coast.";
}

function generateBriefingLines(data, today, workLogs, schedule) {
  const lines = [];
  const prevDayStr = prevDay(today);
  const td_prev = data?.days?.[prevDayStr] || {};
  const TASK_LABELS = { ig_outreach:"DMs", upwork:"Upwork proposals", pushups:"pushups", situps:"situps", client_work:"min client work", ceo_work:"min CEO work", content:"min content", sales_calls:"sales calls" };

  // Only evaluate tasks that were actually in yesterday's schedule
  const prevSchedule = getScheduleForDate(prevDayStr, data?.customSchedules || {});
  const prevTaskIds = new Set();
  for (const block of prevSchedule) {
    const tid = block.taskId || SCHED_TASK_MAP[block.label];
    if (tid) prevTaskIds.add(tid);
  }
  const TARGETS = Object.fromEntries(
    DEFAULT_TASKS.filter(t => prevTaskIds.has(t.id)).map(t => [t.id, t.target])
  );

  const now = new Date();
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];

  // Greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  lines.push(`${greeting}, Deniz.`);

  // Yesterday performance
  const yesterday_done = Object.entries(TARGETS).filter(([tid, t]) => (td_prev[tid]||0) >= t).length;
  const yesterday_total = Object.keys(TARGETS).length;
  if (yesterday_total > 0) {
    if (yesterday_done === yesterday_total) {
      lines.push(`Yesterday: ${yesterday_done}/${yesterday_total} tasks completed. Solid day.`);
    } else {
      const missed = Object.entries(TARGETS).filter(([tid, t]) => (td_prev[tid]||0) < t)
        .map(([tid]) => TASK_LABELS[tid]).slice(0, 2).join(", ");
      lines.push(`Yesterday: ${yesterday_done}/${yesterday_total} done. Missed: ${missed}.`);
    }
  }

  // Streak
  const streak = data?.streak || 0;
  if (streak >= 7) lines.push(`${streak}-day streak. Don't break it.`);
  else if (streak > 0) lines.push(`${streak}-day streak. Build it.`);
  else lines.push(`Streak at 0. Today is day 1 — make it count.`);

  // Today's calls from schedule
  const todayCalls = schedule.filter(s => s.isCallEvent || SCHED_TASK_MAP[s.label] === "sales_calls");
  if (todayCalls.length > 0) {
    lines.push(`You have ${todayCalls.length} call${todayCalls.length > 1 ? "s" : ""} today.`);
  }

  // This week's sales performance (from callLogs)
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split("T")[0]; })();
  const weekCalls = Object.entries(data?.callLogs || {})
    .filter(([date]) => date >= weekStart)
    .flatMap(([, logs]) => logs)
    .filter(c => (c.call_type || "sales") !== "client");
  const closes = weekCalls.filter(c => c.result === "Closed").length;
  const taken = weekCalls.filter(c => c.result && c.result !== "No-show").length;
  if (taken > 0) {
    lines.push(`This week: ${taken} call${taken>1?"s":""} taken, ${closes} closed (${Math.round(closes/taken*100)}% close rate).`);
  }

  // Today's priority (set in yesterday's review)
  const priority = data?.dailyReviews?.[prevDayStr]?.priorityTomorrow;
  if (priority) lines.push(`Your #1 priority today: ${priority}.`);

  // Closing
  lines.push(`It's ${dayName}. Discipline wins. Execute.`);
  return lines;
}

// ─── EditCallModal ────────────────────────────────────────────────────────────
function EditCallModal({ call, onSave, onDelete, onClose }) {
  const [result, setResult] = useState(call.result || "");
  const [notes, setNotes] = useState(call.notes || "");
  const [valueEur, setValueEur] = useState(call.value_eur || "");
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, textAlign: "center" }}>Edit Call</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {CALL_RESULTS.map(r => (
            <button key={r} onClick={() => setResult(r)} style={{ padding: "10px 14px", background: result === r ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)", border: result === r ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: result === r ? 700 : 500, cursor: "pointer", textAlign: "left" }}>{r}</button>
          ))}
        </div>
        {result === "Closed" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Deal value (€)</div>
            <input type="number" placeholder="0" value={valueEur} onChange={e => setValueEur(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, color: "#4ADE80", fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
          </div>
        )}
        <textarea placeholder="Notes..." value={notes} onChange={e => setNotes(e.target.value)}
          style={{ width: "100%", padding: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#fff", fontSize: 13, minHeight: 60, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onDelete()} style={{ padding: "10px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#EF4444", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Delete</button>
          <button disabled={!result} onClick={() => result && onSave({ result, notes, time: call.time, value_eur: Number(valueEur) || 0 })}
            style={{ flex: 1, padding: 12, background: result ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: result ? "#fff" : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 700, cursor: result ? "pointer" : "default" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// CallModal replaced by UnifiedCallModal
const CALL_RESULTS = ["Closed", "Not Closed", "Rescheduled", "No-show"];

// ─── FocusTimerModal ──────────────────────────────────────────────────────────
function FocusTimerModal({ task, seconds, running, onToggle, onReset, onComplete, onDone, onMinimize, onCancel }) {
  const [phase, setPhase] = useState("timer"); // timer | askConfirm | askDesc | askPartial | manual
  const [description, setDescription] = useState("");
  const [partialMins, setPartialMins] = useState("10");
  const [manualMins, setManualMins] = useState("");
  const [manualDesc, setManualDesc] = useState("");

  // When timer reaches 0, switch to confirm phase
  useEffect(() => {
    if (seconds === 0 && phase === "timer") setPhase("askConfirm");
  }, [seconds, phase]);

  const min = Math.floor(seconds / 60), sec = seconds % 60;
  const pct = 1 - seconds / (15 * 60);

  function handleComplete15() {
    onComplete(15, description);
    setDescription("");
    setPhase("timer");
    onReset();
  }
  function handleDone15() { onDone(15, description); }
  function handlePartialDone() { onDone(Number(partialMins) || 0, ""); }
  function handleManualLog() {
    const m = Number(manualMins);
    if (m > 0) onDone(m, manualDesc);
  }

  const headerBtn = phase === "timer" && running
    ? <button onClick={onMinimize} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4, fontSize: 10, letterSpacing: 0.5 }}>minimize</button>
    : <button onClick={onCancel} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4 }}>{I.x}</button>;

  return (
    <div style={S.modalBackdrop} onClick={() => { if (running) onMinimize(); else onCancel(); }}>
      <div style={{ ...S.modalBox, textAlign: "center", maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{task.label}</div>
          {headerBtn}
        </div>

        {phase === "timer" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <svg viewBox="0 0 100 100" width="130" height="130">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
                <circle cx="50" cy="50" r="44" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, (1 - seconds / (15*60))) * 276.5} 276.5`} transform="rotate(-90 50 50)"/>
                <text x="50" y="54" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="inherit">{min}:{String(sec).padStart(2, "0")}</text>
              </svg>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={S.focusPlayBtn} onClick={onToggle}>
                {running ? I.pause : I.play}
                <span style={{ marginLeft: 8 }}>{running ? "Pause" : "Start"}</span>
              </button>
            </div>
            <button onClick={() => setPhase("manual")} style={{ marginTop: 12, background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
              Log manually instead
            </button>
          </>
        )}

        {phase === "askConfirm" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>15 minutes done.</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>Did you work the full time?</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={S.focusYes} onClick={() => setPhase("askDesc")}>Yes — full 15 min</button>
              <button style={S.focusNo} onClick={() => setPhase("askPartial")}>No</button>
            </div>
          </>
        )}

        {phase === "askDesc" && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>What did you work on?</div>
            <textarea placeholder="e.g. 'Built landing page for client X'" value={description} onChange={e => setDescription(e.target.value)}
              style={{ width: "100%", padding: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, minHeight: 70, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 16, textAlign: "left" }} autoFocus />
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={S.focusYes} onClick={handleComplete15}>Start another 15 min</button>
              <button style={S.focusDone} onClick={handleDone15}>Done for now</button>
            </div>
          </>
        )}

        {phase === "askPartial" && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>How many minutes did you actually work?</div>
            <input type="number" value={partialMins} onChange={e => setPartialMins(e.target.value)} min="1" max="15"
              style={{ width: 80, padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 20, fontWeight: 700, textAlign: "center", outline: "none", marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={S.focusDone} onClick={handlePartialDone}>Log & finish</button>
            </div>
          </>
        )}

        {phase === "manual" && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Log time manually</div>
            <input type="number" value={manualMins} onChange={e => setManualMins(e.target.value)} placeholder="Minutes" min="1"
              style={{ width: "100%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 18, fontWeight: 700, textAlign: "center", outline: "none", marginBottom: 12, boxSizing: "border-box" }} autoFocus />
            <textarea placeholder="What did you work on? (optional)" value={manualDesc} onChange={e => setManualDesc(e.target.value)}
              style={{ width: "100%", padding: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, minHeight: 60, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 16, textAlign: "left" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={S.focusYes} onClick={handleManualLog} disabled={!manualMins}>Log {manualMins || 0} min</button>
              <button style={S.focusDone} onClick={() => setPhase("timer")}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── FloatingTimerBar ─────────────────────────────────────────────────────────
function FloatingTimerBar({ task, seconds, running, onToggle, onExpand }) {
  const min = Math.floor(seconds / 60), sec = seconds % 60;
  return (
    <div onClick={onExpand} style={{ position: "fixed", bottom: 74, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 448, background: "rgba(22,22,32,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 98, backdropFilter: "blur(20px)", cursor: "pointer", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: running ? "#4ADE80" : "#FBBF24", animation: running ? "pulse 1.5s infinite" : "none" }}/>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{task.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: seconds < 60 ? "#EF4444" : "#fff" }}>
          {min}:{String(sec).padStart(2, "0")}
        </span>
        <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center" }}>
          {running ? I.pause : I.play}
        </button>
      </div>
    </div>
  );
}

// ─── LogExtraWorkModal ────────────────────────────────────────────────────────
function LogExtraWorkModal({ onLog, onClose }) {
  const [taskName, setTaskName] = useState("");
  const [category, setCategory] = useState("Client Fulfilment");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const cats = ["Fitness", "Client Acquisition", "Client Fulfilment", "Offer Refinement"];
  function submit() {
    const m = Number(minutes);
    if (!taskName.trim() || m < 1) return;
    onLog(taskName.trim(), category, m, description);
  }
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Log Extra Work</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4 }}>{I.x}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="What did you work on?"
            style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", width: "100%" }} autoFocus />
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ padding: "10px 12px", background: "rgba(20,20,28,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", width: "100%", cursor: "pointer" }}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="Minutes" min="1"
              style={{ width: 100, padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", boxSizing: "border-box" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>minutes</span>
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)"
            style={{ padding: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", fontSize: 13, minHeight: 60, resize: "vertical", outline: "none", boxSizing: "border-box", width: "100%" }} />
          <button onClick={submit} disabled={!taskName.trim() || !minutes}
            style={{ padding: "12px", background: taskName.trim() && minutes ? "rgba(0,200,220,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${taskName.trim() && minutes ? "rgba(0,200,220,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, color: taskName.trim() && minutes ? "rgba(0,220,240,0.9)" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: taskName.trim() && minutes ? "pointer" : "default" }}>
            Log Work
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UnifiedCallModal ─────────────────────────────────────────────────────────
function UnifiedCallModal({ initialData = {}, recentCalls = [], onLog, onClose, isEdit = false, onDelete = null }) {
  const [callType, setCallType] = useState(initialData.call_type || "sales");
  const [result, setResult] = useState(initialData.result || "");
  const [value, setValue] = useState(initialData.value_eur || "");
  const [duration, setDuration] = useState(initialData.duration_minutes || 0);
  const [notes, setNotes] = useState(initialData.notes || "");
  const [linkedCallId, setLinkedCallId] = useState(null);
  const [customDur, setCustomDur] = useState(false);

  const isSales = callType === "sales";
  const isRescheduled = callType === "rescheduled";
  const isClient = callType === "client";

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>
          {initialData.title || "Log Call"}
        </div>

        {/* Call Type pills */}
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>Call Type</div>
        <div style={{ display:"flex", gap:6, marginBottom:16 }}>
          {[["sales","Sales","rgba(59,130,246,0.8)"],["client","Client","rgba(139,92,246,0.8)"],["rescheduled","Rescheduled","rgba(245,158,11,0.8)"]].map(([val,label,color]) => (
            <button key={val} onClick={() => setCallType(val)}
              style={{ flex:1, padding:"8px 4px", borderRadius:8, fontSize:12, fontWeight:600, border:"1px solid", cursor:"pointer",
                borderColor: callType===val ? color : "rgba(255,255,255,0.08)",
                background: callType===val ? color.replace("0.8","0.15") : "transparent",
                color: callType===val ? "#fff" : "rgba(255,255,255,0.4)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Outcome (only for sales/rescheduled) */}
        {!isClient && (
          <>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>Outcome</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
              {["Closed","Not Closed","Rescheduled","No-show"].map(r => (
                <button key={r} onClick={() => setResult(r)}
                  style={{ padding:"6px 12px", borderRadius:20, fontSize:11, fontWeight:600, border:"1px solid", cursor:"pointer",
                    borderColor: result===r?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.1)",
                    background: result===r?"rgba(255,255,255,0.12)":"transparent",
                    color: result===r?"#fff":"rgba(255,255,255,0.4)" }}>
                  {r}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Deal value (only for Closed) */}
        {result === "Closed" && (
          <input type="number" value={value} onChange={e=>setValue(e.target.value)}
            placeholder="Deal value (€)" min="0"
            style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#fff", fontSize:13, outline:"none", marginBottom:12 }} />
        )}

        {/* Duration */}
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>Duration</div>
        <div style={{ display:"flex", gap:6, marginBottom:customDur?8:16 }}>
          {[15,30,45,60].map(m => (
            <button key={m} onClick={() => { setDuration(m); setCustomDur(false); }}
              style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontWeight:600, border:"1px solid", cursor:"pointer",
                borderColor: duration===m&&!customDur?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.08)",
                background: duration===m&&!customDur?"rgba(255,255,255,0.12)":"transparent",
                color: duration===m&&!customDur?"#fff":"rgba(255,255,255,0.4)" }}>
              {m}m
            </button>
          ))}
          <button onClick={() => setCustomDur(true)}
            style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontWeight:600, border:"1px solid", cursor:"pointer",
              borderColor: customDur?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.08)",
              background: customDur?"rgba(255,255,255,0.12)":"transparent",
              color: customDur?"#fff":"rgba(255,255,255,0.4)" }}>
            Custom
          </button>
        </div>
        {customDur && (
          <input type="number" value={duration || ""} onChange={e=>setDuration(Number(e.target.value))}
            placeholder="Minutes" min="1"
            style={{ width:80, padding:"8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#fff", fontSize:14, textAlign:"center", outline:"none", marginBottom:16 }} autoFocus />
        )}

        {/* Link to original (rescheduled) */}
        {isRescheduled && recentCalls.length > 0 && (
          <>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>Link to original call (optional)</div>
            <select value={linkedCallId||""} onChange={e=>setLinkedCallId(e.target.value||null)}
              style={{ width:"100%", padding:"8px 10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#fff", fontSize:12, outline:"none", marginBottom:16 }}>
              <option value="">None</option>
              {recentCalls.map((c,i) => (
                <option key={i} value={c.id||i}>{c.date} — {c.result||"No outcome"} — {c.notes?.substring(0,30)||""}</option>
              ))}
            </select>
          </>
        )}

        {/* Notes */}
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)"
          style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#fff", fontSize:13, outline:"none", marginBottom:16 }} />

        {/* Save button */}
        <div style={{ display:"flex", gap:8 }}>
          <button style={S.focusYes}
            disabled={!isClient && !result}
            onClick={() => onLog({
              call_type: callType,
              result: isClient ? "Client Call" : result,
              value_eur: result==="Closed" ? Number(value)||0 : 0,
              duration_minutes: duration || 0,
              notes,
              linked_call_id: linkedCallId,
              gcal_event_id: initialData.gcal_event_id || null,
              event_date: initialData.event_date || null,
            })}>
            {isEdit ? "Update" : "Save"}
          </button>
          <button style={S.focusDone} onClick={onClose}>Cancel</button>
        </div>
        {isEdit && onDelete && (
          <button style={{ ...S.focusDone, color:"rgba(239,68,68,0.7)", borderColor:"rgba(239,68,68,0.2)", marginTop:8, width:"100%" }}
            onClick={onDelete}>
            Delete Call
          </button>
        )}
      </div>
    </div>
  );
}

// ─── GcalClassifyModal ────────────────────────────────────────────────────────
function GcalClassifyModal({ ev, onSave, onClose }) {
  const current = getGcalEventClassification(ev.id);
  const [type, setType] = useState(current);
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, maxWidth: 300 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>Classify call</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:16 }}>{ev.title}</div>
        {[["sales","Sales Call","rgba(59,130,246,0.8)"],["client","Client Call","rgba(139,92,246,0.8)"],["rescheduled","Rescheduled","rgba(245,158,11,0.8)"]].map(([val,label,color]) => (
          <button key={val} onClick={() => setType(val)}
            style={{ display:"block", width:"100%", padding:"10px 14px", marginBottom:8, borderRadius:8, fontSize:13, fontWeight:600, border:"1px solid", cursor:"pointer", textAlign:"left",
              borderColor: type===val ? color : "rgba(255,255,255,0.08)",
              background: type===val ? color.replace("0.8","0.15") : "transparent",
              color: type===val ? "#fff" : "rgba(255,255,255,0.5)" }}>
            {label}
          </button>
        ))}
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <button style={S.focusYes} onClick={() => { saveGcalEventClassification(ev.id, type); onSave(type); }}>Save</button>
          <button style={S.focusDone} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── QuickAddModal ────────────────────────────────────────────────────────────
function QuickAddModal({ onLog, onClose }) {
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Client Acquisition");
  const [dur, setDur] = useState(30);
  const [customDur, setCustomDur] = useState(false);
  const CATS = ["Fitness","Client Acquisition","Client Fulfilment","Offer Refinement"];
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, maxWidth:320 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Quick Log</div>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What did you work on?"
          style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#fff", fontSize:13, outline:"none", marginBottom:12 }} autoFocus />
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ padding:"5px 10px", borderRadius:16, fontSize:10, fontWeight:600, border:"1px solid", cursor:"pointer",
                borderColor: cat===c?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.08)",
                background: cat===c?"rgba(255,255,255,0.12)":"transparent",
                color: cat===c?"#fff":"rgba(255,255,255,0.4)" }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:6, marginBottom:16 }}>
          {[15,30,60,120].map(m => (
            <button key={m} onClick={() => { setDur(m); setCustomDur(false); }}
              style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontWeight:600, border:"1px solid", cursor:"pointer",
                borderColor: dur===m&&!customDur?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.08)",
                background: dur===m&&!customDur?"rgba(255,255,255,0.12)":"transparent",
                color: dur===m&&!customDur?"#fff":"rgba(255,255,255,0.4)" }}>
              {m>=60?`${m/60}h`:`${m}m`}
            </button>
          ))}
          <button onClick={() => setCustomDur(true)}
            style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontWeight:600, border:"1px solid", cursor:"pointer",
              borderColor: customDur?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.08)",
              background: customDur?"rgba(255,255,255,0.12)":"transparent",
              color: customDur?"#fff":"rgba(255,255,255,0.4)" }}>
            ...
          </button>
        </div>
        {customDur && (
          <input type="number" value={dur||""} onChange={e=>setDur(Number(e.target.value))} placeholder="min"
            style={{ width:70, padding:"8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#fff", fontSize:14, textAlign:"center", outline:"none", marginBottom:12 }} autoFocus />
        )}
        <button style={S.focusYes} onClick={() => { if (desc && dur) { onLog({ description: desc, category: cat, minutes: dur }); onClose(); } }}>Log</button>
      </div>
    </div>
  );
}

// GcalCallPopup replaced by UnifiedCallModal

// ─── MorningBriefing ──────────────────────────────────────────────────────────
function MorningBriefing({ lines, onDismiss }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (visible >= lines.length) return;
    const t = setTimeout(() => setVisible(v => v + 1), 400);
    return () => clearTimeout(t);
  }, [visible, lines.length]);
  return (
    <div style={S.briefingBackdrop}>
      <div style={S.briefingInner}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: "40px 0" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ opacity: i < visible ? 1 : 0, transform: i < visible ? "none" : "translateY(12px)", transition: "opacity 0.5s ease, transform 0.5s ease", fontSize: i === 0 ? 24 : 15, fontWeight: i === 0 ? 800 : 500, color: i === 0 ? "#fff" : "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
              {line}
            </div>
          ))}
        </div>
        {visible >= lines.length && (
          <button onClick={onDismiss} style={{ width: "100%", padding: "14px", background: "#fff", border: "none", borderRadius: 12, color: "#0A0A0F", fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}>
            Let&apos;s go
          </button>
        )}
      </div>
    </div>
  );
}

// ─── EndOfDayReview ───────────────────────────────────────────────────────────
function EndOfDayReview({ data, today, workLogs, todayTasks, existingSummary, onSave, onClose }) {
  const [rating, setRating] = useState(0);
  const [priority, setPriority] = useState("");
  const [summary, setSummary] = useState(existingSummary || "");

  const td = data?.days?.[today] || {};
  const todayWL = workLogs?.[today] || [];
  const calls = data?.callLogs?.[today] || [];

  const completedCount = todayTasks.filter(t => (td[t.id] || 0) >= t.target).length;
  const pct = todayTasks.length > 0 ? completedCount / todayTasks.length : 0;
  const ringColor = pct >= 0.8 ? "#4ADE80" : pct >= 0.5 ? "#FBBF24" : "#EF4444";
  const ringDash = pct * 276.5;

  const weekAvg = (taskId) => {
    let total = 0, count = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const v = data?.days?.[ds]?.[taskId];
      if (v != null) { total += v; count++; }
    }
    return count > 0 ? Math.round(total / count) : null;
  };

  const closedCalls = calls.filter(c => c.result === "Closed");
  const callRevenue = closedCalls.reduce((s, c) => s + (Number(c.value_eur) || 0), 0);
  const monthRevenue = computeMonthlyRevenue(data?.callLogs || {});

  const commentary = (() => {
    const missedTasks = todayTasks.filter(t => (td[t.id] || 0) < t.target).map(t => t.label);
    if (pct === 1) return closedCalls.length > 0
      ? `Perfect execution — all ${completedCount} tasks done. €${callRevenue.toLocaleString()} closed today. This is how empires are built.`
      : `Perfect execution — all ${completedCount} tasks done. Consistent days like this build great companies.`;
    if (pct >= 0.7) return `${completedCount}/${todayTasks.length} tasks done. Still missed: ${missedTasks.join(", ")}. Good isn't great — close that gap tomorrow.`;
    if (pct >= 0.5) return `Half your schedule was missed. ${completedCount}/${todayTasks.length} tasks done. ${missedTasks.join(", ")} left on the table. Fix this tomorrow.`;
    if (pct > 0) return `Only ${completedCount}/${todayTasks.length} tasks completed. Missed: ${missedTasks.join(", ")}. This was a bad day. What needs to change tomorrow?`;
    return `0/${todayTasks.length} tasks completed today. This is not how you build a business. Reset completely — tomorrow is a fresh start.`;
  })();

  const dn = new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0A0A0F", zIndex: 300, overflowY: "auto" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 24px 120px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Day in Review</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div>
          {/* Completion ring */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <svg viewBox="0 0 100 100" width="90" height="90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
              <circle cx="50" cy="50" r="44" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${ringDash} 276.5`} transform="rotate(-90 50 50)"/>
              <text x="50" y="54" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800" fontFamily="inherit">{Math.round(pct * 100)}%</text>
            </svg>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{dn}</div>
              <div style={{ fontSize: 13, color: ringColor, fontWeight: 600 }}>{completedCount}/{todayTasks.length} tasks complete</div>
            </div>
          </div>

          {/* Task cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {todayTasks.map(t => {
              const val = td[t.id] || 0;
              const done = val >= t.target;
              const logs = todayWL.filter(l => l.taskId === t.id);
              const mins = logs.reduce((s, l) => s + l.minutes, 0);
              const displayVal = t.unit === "min" ? mins : val;
              const taskPct = Math.min(displayVal / t.target, 1);
              const avg = weekAvg(t.id);
              const improvement = avg != null && displayVal > 0 ? Math.round((displayVal - avg) / Math.max(avg, 1) * 100) : null;
              const descs = logs.map(l => l.description).filter(Boolean).slice(0, 2).join(", ");
              return (
                <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", border: `1px solid ${done ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {done
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                      <span style={{ fontSize: 13, fontWeight: 600, color: done ? "#fff" : "rgba(255,255,255,0.6)" }}>{t.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {improvement != null && improvement !== 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: improvement > 0 ? "#4ADE80" : "#EF4444" }}>
                          {improvement > 0 ? "▲" : "▼"}{Math.abs(improvement)}% vs avg
                        </span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 700, color: done ? "#4ADE80" : "rgba(255,255,255,0.4)" }}>
                        {t.unit === "min" ? formatMin(displayVal) : `${displayVal}/${t.target}`}
                      </span>
                    </div>
                  </div>
                  {t.unit !== "min" && (
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 4 }}>
                      <div style={{ height: "100%", width: `${taskPct * 100}%`, background: done ? "#4ADE80" : "#FBBF24", borderRadius: 2 }}/>
                    </div>
                  )}
                  {descs && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>&quot;{descs}&quot;</div>}
                  {avg != null && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>7-day avg: {t.unit === "min" ? formatMin(avg) : avg}</div>}
                </div>
              );
            })}
          </div>

          {/* Calls summary */}
          {calls.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Calls today</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div><span style={{ fontSize: 18, fontWeight: 800 }}>{calls.length}</span><span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>total</span></div>
                <div><span style={{ fontSize: 18, fontWeight: 800, color: "#4ADE80" }}>{closedCalls.length}</span><span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>closed</span></div>
                {callRevenue > 0 && <div><span style={{ fontSize: 18, fontWeight: 800, color: "#4ADE80" }}>€{callRevenue.toLocaleString()}</span><span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>today</span></div>}
              </div>
              {monthRevenue > 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>Monthly total: <span style={{ color: "#4ADE80", fontWeight: 700 }}>€{monthRevenue.toLocaleString()}</span></div>}
            </div>
          )}

          {/* Commentary */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 24, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, borderLeft: `3px solid ${ringColor}` }}>
            {commentary}
          </div>

          {/* Today's Summary */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Today&apos;s Summary</div>
          <textarea
            placeholder="What did you accomplish today?"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 20, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          />

          {/* Rating */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Rate your day</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setRating(s)} style={{ background: "none", border: "none", cursor: "pointer", color: s <= rating ? "#FFD700" : "rgba(255,255,255,0.2)", padding: 0 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill={s <= rating ? "#FFD700" : "none"} stroke={s <= rating ? "#FFD700" : "rgba(255,255,255,0.3)"} strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            ))}
          </div>

          {/* Priority tomorrow */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Your #1 priority tomorrow</div>
          <input placeholder="e.g. Close the Funnels client deal" value={priority} onChange={e => setPriority(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
          <button onClick={() => onSave(rating, priority, summary)} style={{ width: "100%", padding: "13px", background: "#fff", border: "none", borderRadius: 12, color: "#0A0A0F", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            Save &amp; close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WhatShouldIDoModal ───────────────────────────────────────────────────────
function WhatShouldIDoModal({ message, onClose }) {
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Right now</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 0 }}>{I.x}</button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5, color: "#fff" }}>{message}</div>
      </div>
    </div>
  );
}

// ─── ScheduleEditor ───────────────────────────────────────────────────────────
const TASK_PRESETS = [
  { label: "Morning Workout", dur: 60, taskId: "pushups" },
  { label: "Evening Workout", dur: 30, taskId: "situps" },
  { label: "Instagram Outreach", dur: 90, taskId: "ig_outreach" },
  { label: "Upwork Proposals", dur: 60, taskId: "upwork" },
  { label: "Client Delivery", dur: 120, taskId: "client_work" },
  { label: "CEO Strategy", dur: 120, taskId: "ceo_work" },
  { label: "Content Creation", dur: 60, taskId: "content" },
  { label: "Class", dur: 360, taskId: null },
  { label: "Deep Work", dur: 90, taskId: null },
  { label: "Break", dur: 30, taskId: null },
  { label: "Custom", dur: 60, taskId: null },
];

function ScheduleEditor({ draft, onChange, onSave, onCancel }) {
  const [adding, setAdding] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState({ time: "09:00", label: "", dur: 60, taskId: null, category: "", customType: "timer", target: null, unit: "", blockId: "" });
  const [showPresets, setShowPresets] = useState(false);

  const sorted = [...draft].sort((a, b) => a.time.localeCompare(b.time));

  function openAdd() {
    setForm({ time: "09:00", label: "", dur: 60, taskId: null, category: "", customType: "timer", target: null, unit: "", blockId: "" });
    setAdding(true);
    setEditIdx(null);
    setShowPresets(true);
  }

  function openEdit(idx) {
    const s = sorted[idx];
    const task = s.taskId ? TASK_BY_ID[s.taskId] : null;
    const isCounter = task ? task.unit !== "min" : s.customType === "counter";
    setForm({
      time: s.time, label: s.label, dur: s.dur, taskId: s.taskId || null,
      category: s.category || "",
      customType: s.customType || (isCounter ? "counter" : "timer"),
      target: s.target ?? (isCounter && task ? task.target : null),
      unit: s.unit || task?.unit || "",
      blockId: s.blockId || "",
    });
    setEditIdx(idx);
    setAdding(false);
    setShowPresets(false);
  }

  function applyPreset(preset) {
    const task = preset.taskId ? TASK_BY_ID[preset.taskId] : null;
    const isCounter = task?.unit !== "min";
    setForm(f => ({
      ...f, label: preset.label, dur: preset.dur, taskId: preset.taskId,
      category: preset.taskId ? "" : f.category,
      customType: isCounter ? "counter" : "timer",
      target: isCounter ? (task?.target ?? null) : null,
      unit: isCounter ? (task?.unit ?? "") : "",
      blockId: "",
    }));
    setShowPresets(false);
  }

  function saveBlock() {
    if (!form.label.trim() || !form.time) return;
    const task = form.taskId ? TASK_BY_ID[form.taskId] : null;
    const isCounter = task ? task.unit !== "min" : form.customType === "counter";
    // All custom blocks (no taskId) get a stable blockId so progress isn't lost when label changes
    const prefix = isCounter ? "block_" : "timer_";
    const customBlockId = !form.taskId
      ? (form.blockId || (prefix + form.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")))
      : undefined;
    const block = {
      time: form.time, label: form.label.trim(), dur: Number(form.dur) || 60,
      ...(form.taskId ? { taskId: form.taskId } : {}),
      ...(isCounter && form.target != null ? { target: Number(form.target), unit: form.unit || task?.unit || "" } : {}),
      ...(!form.taskId ? { customType: isCounter ? "counter" : "timer", blockId: customBlockId } : {}),
      ...(form.category && !form.taskId ? { category: form.category } : {}),
    };
    let next;
    if (adding) {
      next = [...draft, block];
    } else {
      const originalLabel = sorted[editIdx].label;
      const originalTime = sorted[editIdx].time;
      next = draft.map(d => d.time === originalTime && d.label === originalLabel ? block : d);
    }
    onChange(next.sort((a, b) => a.time.localeCompare(b.time)));
    setAdding(false);
    setEditIdx(null);
  }

  function removeBlock(idx) {
    const s = sorted[idx];
    onChange(draft.filter(d => !(d.time === s.time && d.label === s.label)));
    setEditIdx(null);
  }

  const isFormOpen = adding || editIdx !== null;
  const isCounterForm = form.taskId ? TASK_BY_ID[form.taskId]?.unit !== "min" : form.customType === "counter";

  return (
    <div>
      {/* Block list */}
      {sorted.map((s, i) => {
        const bTask = s.taskId ? TASK_BY_ID[s.taskId] : null;
        const bIsCounter = bTask ? bTask.unit !== "min" : s.customType === "counter";
        const bTarget = s.target ?? bTask?.target;
        const bUnit = s.unit || bTask?.unit || "";
        return (
          <div key={i} onClick={() => editIdx === i ? setEditIdx(null) : openEdit(i)}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", marginBottom:6, borderRadius:10,
              background: editIdx===i ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${editIdx===i?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.05)"}`, cursor:"pointer" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", width:40, flexShrink:0 }}>{s.time}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#fff" }}>{s.label}</div>
              {bIsCounter && bTarget != null
                ? <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:1 }}>{bTarget} {bUnit}</div>
                : (!s.taskId && s.category
                  ? <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:1 }}>{s.category}</div>
                  : null)}
            </div>
            {!bIsCounter && <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{formatTime(s.dur)}</div>}
          </div>
        );
      })}

      {/* Inline edit form */}
      {isFormOpen && (
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"14px", marginBottom:10, marginTop:6 }}>

          {/* Preset picker */}
          {showPresets && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:6, fontWeight:700, letterSpacing:1 }}>PICK A BLOCK TYPE</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {TASK_PRESETS.map((p, pi) => (
                  <button key={pi} onClick={() => applyPreset(p)}
                    style={{ padding:"5px 10px", borderRadius:16, fontSize:11, fontWeight:600, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.7)", cursor:"pointer" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom block type picker (timer vs counter) — only for blocks without a linked task */}
          {!form.taskId && !showPresets && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:6, fontWeight:700, letterSpacing:1 }}>TRACKING TYPE</div>
              <div style={{ display:"flex", gap:6 }}>
                {[["timer","Timer (duration)"],["counter","Counter (reps/count)"]].map(([type, label]) => (
                  <button key={type} onClick={() => setForm(f => ({ ...f, customType: type }))}
                    style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontWeight:700, border:"1px solid", cursor:"pointer",
                      borderColor: form.customType===type ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)",
                      background: form.customType===type ? "rgba(255,255,255,0.1)" : "transparent",
                      color: form.customType===type ? "#fff" : "rgba(255,255,255,0.35)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time row */}
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>Time</div>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                style={{ width:"100%", padding:"8px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:14, fontWeight:700, outline:"none", boxSizing:"border-box", colorScheme:"dark" }} />
            </div>
            {/* Duration — only for timer tasks */}
            {!isCounterForm && (
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>Duration (min)</div>
                <input type="number" value={form.dur} onChange={e => setForm(f => ({ ...f, dur: e.target.value }))} min="5" step="5"
                  style={{ width:"100%", padding:"8px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:14, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
              </div>
            )}
            {/* Target + Unit — only for counter tasks */}
            {isCounterForm && (
              <>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>Target</div>
                  <input type="number" value={form.target ?? ""} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} min="1" placeholder="e.g. 50"
                    style={{ width:"100%", padding:"8px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:14, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>Unit</div>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    style={{ width:"100%", padding:"8px 10px", background:"rgba(30,30,40,1)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }}>
                    <option value="reps">reps</option>
                    <option value="sent">sent</option>
                    <option value="calls">calls</option>
                    <option value="count">count</option>
                    <option value="pages">pages</option>
                    <option value="mins">mins</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Label */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>Label</div>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Block name..."
              style={{ width:"100%", padding:"8px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>

          {/* Category — only shown for custom blocks without a linked task */}
          {!form.taskId && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>Category (for stats breakdown)</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {["Fitness","Client Acquisition","Client Fulfilment","Offer Refinement"].map(cat => (
                  <button key={cat} onClick={() => setForm(f => ({ ...f, category: f.category === cat ? "" : cat }))}
                    style={{ padding:"5px 10px", borderRadius:16, fontSize:11, fontWeight:600, border:"1px solid", cursor:"pointer",
                      borderColor: form.category===cat ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.08)",
                      background: form.category===cat ? "rgba(255,255,255,0.1)" : "transparent",
                      color: form.category===cat ? "#fff" : "rgba(255,255,255,0.4)" }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duration quick picks — only for timer tasks */}
          {!isCounterForm && (
            <div style={{ display:"flex", gap:6, marginBottom:12 }}>
              {[30,60,90,120,180].map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, dur: m }))}
                  style={{ flex:1, padding:"5px 0", borderRadius:6, fontSize:10, fontWeight:700, border:"1px solid", cursor:"pointer",
                    borderColor: Number(form.dur)===m ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)",
                    background: Number(form.dur)===m ? "rgba(255,255,255,0.1)" : "transparent",
                    color: Number(form.dur)===m ? "#fff" : "rgba(255,255,255,0.35)" }}>
                  {m>=60?`${m/60}h`:`${m}m`}
                </button>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={saveBlock} style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {adding ? "Add Block" : "Update"}
            </button>
            {!adding && (
              <button onClick={() => removeBlock(editIdx)} style={{ padding:"9px 14px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(239,68,68,0.7)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                Remove
              </button>
            )}
            <button onClick={() => { setAdding(false); setEditIdx(null); }} style={{ padding:"9px 14px", borderRadius:8, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.35)", fontSize:12, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add block button */}
      {!isFormOpen && (
        <button onClick={openAdd} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%", padding:"10px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", fontSize:12, fontWeight:600, cursor:"pointer", marginTop:4 }}>
          + Add Block
        </button>
      )}

      {/* Save / Cancel */}
      <div style={{ display:"flex", gap:8, marginTop:14 }}>
        <button onClick={onSave} style={{ flex:1, padding:"12px", borderRadius:10, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer" }}>
          Save Schedule
        </button>
        <button onClick={onCancel} style={{ padding:"12px 16px", borderRadius:10, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function DenizHQ() {
  const [tab, setTab]         = useState("home");
  const [data, setData]       = useState(() => _ls?.data ?? null);
  const [loaded, setLoaded]   = useState(() => _ls?.data != null);
  // Custom task targets — persisted to localStorage
  const [customTargets, setCustomTargets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("deniz_custom_targets") || "{}"); } catch { return {}; }
  });
  const saveCustomTargets = (next) => {
    setCustomTargets(next);
    localStorage.setItem("deniz_custom_targets", JSON.stringify(next));
  };
  // Effective tasks = DEFAULT_TASKS with custom targets merged in
  const TASKS = DEFAULT_TASKS.map(t => ({ ...t, target: customTargets[t.id] ?? t.target }));
  const TASKS_BY_ID = Object.fromEntries(TASKS.map(t => [t.id, t]));
  const [callModal, setCallModal]     = useState(false); // false, {} for new, or { _isEdit, _date, _index, ...callData }
  const [calDate, setCalDate]         = useState(new Date());
  const [weekOffset, setWeekOffset]   = useState(0);
  const [editingDay, setEditingDay]   = useState(null);
  const [editDraft, setEditDraft]     = useState([]);
  const [customSchedules, setCustomSchedules] = useState(() => _ls?.customSchedules ?? {});
  const [revenue, setRevenue]         = useState(() => _ls?.revenue ?? Number(localStorage.getItem("deniz_revenue") || 0));
  const [editingRevenue, setEditingRevenue] = useState(false);
  const [workLogs, setWorkLogs]       = useState(() => _ls?.data?.workLogs ?? {});
  const [dailyReviews, setDailyReviews] = useState(() => _ls?.data?.dailyReviews ?? {});
  const [showBriefing, setShowBriefing] = useState(false);
  const [showEOD, setShowEOD]         = useState(false);
  const [pastReviewDate, setPastReviewDate] = useState(null); // date string for editing past day review
  const [whatModal, setWhatModal]     = useState(false);
  const [taskStreaks, setTaskStreaks]  = useState({});
  const [notifActive, setNotifActive] = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");

  // Timer state (lifted from FocusTimerModal)
  const [timerTask, setTimerTask]       = useState(null);
  const [timerSecs, setTimerSecs]       = useState(15 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerOpen, setTimerOpen]       = useState(false);

  // Extra features
  const [extraWorkModal, setExtraWorkModal] = useState(false);
  const [durationToast, setDurationToast]   = useState(null); // { taskId, label }
  const [gcalConnected, setGcalConnected]   = useState(() => Boolean(getStoredGcalToken()));
  const [gcalLoading, setGcalLoading]       = useState(false);
  const [gcalError, setGcalError]           = useState(null);
  const [gcalEventsByDate, setGcalEventsByDate] = useState(() => getAllGcalEventsByDate());
  const [gcalAutoPopup, setGcalAutoPopup]   = useState(null); // GCal call event that needs logging
  const [classifyModal, setClassifyModal]   = useState(null); // GCal event
  const [fabModal, setFabModal]             = useState(false);
  const [revenueGoal, setRevenueGoal]       = useState(() => Number(localStorage.getItem("deniz_revenue_goal")) || 0);
  const [editingGoal, setEditingGoal]       = useState(false);

  // Stats
  const [statsView, setStatsView]     = useState("daily");
  const [statsDate, setStatsDate]     = useState(() => new Date());
  const [statsPeriod, setStatsPeriod] = useState("week");

  // Refs so notification loop always reads fresh values without re-running the effect
  const dataRef              = useRef(null);
  const customSchedulesRef   = useRef({});
  const todayPriorityRef     = useRef(null);
  const todayTasksRef        = useRef([]); // always current todayTasks for use inside callbacks
  const revenueGoalRef       = useRef(0);

  const today = getToday();

  // ── Persist full state on every change ────────────────────────────────────
  useEffect(() => {
    if (!data) return;
    const fullData = { ...data, workLogs, dailyReviews };
    writeLocalState({ data: fullData, customSchedules, revenue });
  }, [data, customSchedules, revenue, workLogs, dailyReviews]);

  // ── Supabase sync on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const d = await loadData();
        setData(d);
        if (d.customSchedules) setCustomSchedules(d.customSchedules);
        if (d.revenue != null) setRevenue(d.revenue);
        if (d.workLogs) setWorkLogs(d.workLogs);
        if (d.dailyReviews) setDailyReviews(d.dailyReviews);
      } catch (e) {
        console.error("[Deniz HQ] loadData failed:", e);
        if (!data) setData({ days: {}, callLogs: {}, workLogs: {}, dailyReviews: {}, ceoLogs: {}, streak: 0, rank: 0 });
      }
      setLoaded(true);
    })();
    initNotifications().catch(console.warn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Morning briefing: show once per day ───────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const key = `deniz-hq-briefing-${today}`;
    if (!localStorage.getItem(key)) setShowBriefing(true);
  }, [loaded, today]);

  // ── Auto EOD after 21:00 (once per day) ──────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const h = new Date().getHours();
    if (h < 21) return;
    const key = `deniz-hq-eod-${today}`;
    if (!localStorage.getItem(key)) setShowEOD(true);
  }, [loaded, today]);

  // ── Compute task streaks when data changes ─────────────────────────────────
  useEffect(() => {
    if (!data) return;
    setTaskStreaks(computeTaskStreaks(data.days || {}));
  }, [data]);

  // ── Timer countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerSecs(s => {
        if (s <= 1) { setTimerRunning(false); setTimerOpen(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  // ── Persist timer state ───────────────────────────────────────────────────
  useEffect(() => {
    if (timerTask) {
      localStorage.setItem("deniz_timer_v2", JSON.stringify({ taskId: timerTask.id, secs: timerSecs, running: timerRunning, savedAt: Date.now() }));
    } else {
      localStorage.removeItem("deniz_timer_v2");
    }
  }, [timerTask, timerSecs, timerRunning]);

  // ── Restore timer on first load ───────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    try {
      const s = localStorage.getItem("deniz_timer_v2");
      if (!s) return;
      const { taskId, secs, running, savedAt } = JSON.parse(s);
      const task = TASK_BY_ID[taskId]; if (!task) return;
      const elapsed = running && savedAt ? Math.floor((Date.now() - savedAt) / 1000) : 0;
      const remaining = Math.max(0, (secs || 15 * 60) - elapsed);
      setTimerTask(task); setTimerSecs(remaining); setTimerRunning(false);
    } catch {}
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Google Calendar: fetch 30 days of events ─────────────────────────────
  const fetchGcalEvents = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    console.log("[GCal] Fetching 30 days:", start, "to", end);
    await fetchCalendarEvents(start, end);
    const byDate = getAllGcalEventsByDate();
    console.log("[GCal] Updated events by date, days with events:", Object.keys(byDate).length);
    setGcalEventsByDate(byDate);

    // Check for past call events not yet prompted
    const todayStr = new Date().toISOString().split("T")[0];
    const todayEvents = byDate[todayStr] || [];
    const prompted = JSON.parse(localStorage.getItem("gcal_prompted") || "[]");
    const nowMs = Date.now();
    for (const ev of todayEvents) {
      if (ev.isCallEvent && new Date(ev.end).getTime() < nowMs && !prompted.includes(ev.id)) {
        setGcalAutoPopup(ev);
        break;
      }
    }
  }, []);

  // ── Restore GCal token on load + load cached events ───────────────────────
  useEffect(() => {
    if (!loaded) return;
    const savedToken  = localStorage.getItem("gcal_token");
    const savedExpiry = localStorage.getItem("gcal_token_expiry");
    console.log("[GCal] Checking saved token:", !!savedToken, "expiry:", savedExpiry, "now:", Date.now());

    if (savedToken && savedExpiry && Date.now() < Number(savedExpiry)) {
      console.log("[GCal] Restoring saved connection");
      restoreGcalToken(savedToken);
      setGcalConnected(true);
      fetchGcalEvents();
    } else {
      console.log("[GCal] No valid saved token");
      const byDate = getAllGcalEventsByDate();
      if (Object.keys(byDate).length > 0) {
        setGcalEventsByDate(byDate);
      }
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-refresh GCal events every 15 min (+ immediately on connect) ──────
  useEffect(() => {
    if (!gcalConnected) return;
    const id = setInterval(fetchGcalEvents, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [gcalConnected, fetchGcalEvents]);

  // ── Duration toast auto-dismiss ────────────────────────────────────────────
  useEffect(() => {
    if (!durationToast) return;
    const t = setTimeout(() => setDurationToast(null), 10000);
    return () => clearTimeout(t);
  }, [durationToast]);

  const td = data?.days?.[today] || {};
  const schedule = getScheduleForDate(today, customSchedules);

  // Merge GCal events into today's schedule
  const mergedTodaySchedule = (() => {
    const todayGcalEvents = gcalEventsByDate[today] || [];
    const gcalBlocks = todayGcalEvents.map(ev => eventToScheduleBlock(ev));
    // Only add GCal blocks that don't overlap with existing manual blocks
    const manualTimes = new Set(schedule.map(s => s.time));
    const newBlocks = gcalBlocks.filter(b => !manualTimes.has(b.time));
    return [...schedule, ...newBlocks].sort((a, b) => {
      const aMs = a.startMs || (parseInt(a.time.split(":")[0]) * 60 + parseInt(a.time.split(":")[1] || 0)) * 60000;
      const bMs = b.startMs || (parseInt(b.time.split(":")[0]) * 60 + parseInt(b.time.split(":")[1] || 0)) * 60000;
      return aMs - bMs;
    });
  })();

  const todayTasks = getTodaysTasks(schedule, TASKS_BY_ID);
  const todayPriority = dailyReviews?.[prevDay(today)]?.priorityTomorrow || null;

  // Keep refs fresh so the notification loop always has current data
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { customSchedulesRef.current = customSchedules; }, [customSchedules]);
  useEffect(() => { todayPriorityRef.current = todayPriority; }, [todayPriority]);
  useEffect(() => { todayTasksRef.current = todayTasks; }, [todayTasks]);
  useEffect(() => { revenueGoalRef.current = revenueGoal; }, [revenueGoal]);

  // ── Direct notification loop — fires immediately + every 30 min ───────────
  useEffect(() => {
    if (!loaded) return;

    async function fire() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const sched = getScheduleForDate(today, customSchedulesRef.current);
      const taskData = dataRef.current?.days?.[today] || {};
      const payload = getNotificationPayload(sched, taskData, todayPriorityRef.current, todayTasksRef.current, revenueGoalRef.current);
      const { title, body } = payload || { title: "Deniz HQ", body: "Stay disciplined. Execute." };
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: NOTIF_ICON,
          badge: NOTIF_ICON,
          vibrate: [200, 100, 200],
          tag: "deniz-hq",
          renotify: true,
          requireInteraction: false,
          data: { url: "/" },
        });
      } catch (e) {
        console.warn("[Notif] showNotification failed:", e);
      }
    }

    fire(); // no await needed, it's async
    // Then at every :00 / :30 clock mark
    const now = new Date();
    const minsToSlot = 30 - (now.getMinutes() % 30);
    const msToSlot = minsToSlot * 60 * 1000 - now.getSeconds() * 1000;
    let intervalId;
    const timeoutId = setTimeout(() => {
      fire();
      intervalId = setInterval(() => fire(), 30 * 60 * 1000);
    }, msToSlot);

    setNotifActive(typeof Notification !== "undefined" && Notification.permission === "granted");
    return () => { clearTimeout(timeoutId); clearInterval(intervalId); };
  }, [loaded, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed revenue from closed deals ────────────────────────────────────
  const computedRevenue = computeMonthlyRevenue(data?.callLogs || {});
  const displayRevenue = computedRevenue > 0 ? computedRevenue : revenue;

  // ── Task update ───────────────────────────────────────────────────────────
  const updateTask = useCallback((id, val) => {
    const newVal = Math.max(0, Number(val) || 0);
    // Use schedule-derived task first (has block-level targets + custom tasks), fall back to TASKS_BY_ID
    const taskDef = todayTasksRef.current.find(t => t.id === id) || TASKS_BY_ID[id];
    const prevVal = td[id] || 0;
    const d = { ...data, days: { ...data.days, [today]: { ...td, [id]: newVal } } };
    const sched = getScheduleForDate(today, customSchedules);
    const tTasks = getTodaysTasks(sched, TASKS_BY_ID);
    const all = tTasks.length > 0 && tTasks.every(t => (d.days[today][t.id] || 0) >= t.target);
    let streakChanged = false;
    if (all && !d.days[today]._done) {
      d.days[today]._done = true;
      d.streak = (d.streak || 0) + 1;
      const nr = RANKS.findIndex((r, i) => i > (d.rank || 0) && d.streak >= r.min);
      if (nr > 0) d.rank = nr;
      streakChanged = true;
    }
    setData(d);
    saveTaskValue(today, id, newVal).catch(console.error);
    if (d.days[today]._done) saveDayDone(today, true).catch(console.error);
    if (streakChanged) saveStreak(d.streak, d.rank).catch(console.error);
    // Show duration toast when count task hits target for the first time
    if (taskDef && taskDef.unit !== "min" && newVal >= taskDef.target && prevVal < taskDef.target) {
      setDurationToast({ taskId: id, label: taskDef.label });
    }
  }, [data, today, td, customSchedules]);

  // ── Work log (from focus timer) ───────────────────────────────────────────
  const logWork = useCallback((taskId, minutes, description) => {
    if (!minutes) return;
    // For unknown task IDs (custom timer blocks), use the category from the schedule task
    const knownCat = getTaskCategory(taskId, taskId);
    const schedTask = todayTasksRef.current.find(t => t.id === taskId);
    const category = knownCat !== "Other" ? knownCat : (schedTask?.cat || "Other");
    const entry = { taskId, minutes, description, timestamp: new Date().toISOString(), category };
    const updated = { ...workLogs, [today]: [...(workLogs[today] || []), entry] };
    setWorkLogs(updated);
    // Also update task value (sum all logged minutes)
    const total = (updated[today] || []).filter(l => l.taskId === taskId).reduce((s, l) => s + l.minutes, 0);
    updateTask(taskId, total);
    saveWorkLog(today, taskId, minutes, description, category).catch(console.error);
  }, [workLogs, today, updateTask]);

  // ── Extra work log ────────────────────────────────────────────────────────
  const logExtraWork = useCallback((arg1, arg2, arg3, arg4) => {
    // Support both old signature (taskName, category, minutes, description) and new ({ description, category, minutes })
    let taskName, category, minutes, description;
    if (typeof arg1 === "object" && arg1 !== null) {
      description = arg1.description || "";
      category = arg1.category || "Client Acquisition";
      minutes = arg1.minutes || 0;
      taskName = description;
    } else {
      taskName = arg1; category = arg2; minutes = arg3; description = arg4;
    }
    if (!minutes) return;
    const entry = { taskId: "_extra", minutes, description, timestamp: new Date().toISOString(), category, label: taskName };
    const updated = { ...workLogs, [today]: [...(workLogs[today] || []), entry] };
    setWorkLogs(updated);
    saveWorkLog(today, "_extra", minutes, `[${taskName}] ${description || ""}`, category).catch(console.error);
    setExtraWorkModal(false);
  }, [workLogs, today]);

  // ── Delete work log ───────────────────────────────────────────────────────
  const deleteWorkLog = useCallback((date, index) => {
    const updated = { ...workLogs };
    if (!updated[date]) return;
    updated[date] = updated[date].filter((_, i) => i !== index);
    setWorkLogs(updated);
    const d = { ...data };
    writeLocalState({ data: { ...d, workLogs: updated }, revenue, customSchedules });
    // Supabase: delete all work logs for this date then re-insert remaining
    (async () => {
      try {
        const deviceId = getDeviceId();
        await supabase.from("work_logs").delete().eq("device_id", deviceId).eq("date", date);
        for (const l of (updated[date] || [])) {
          await supabase.from("work_logs").insert({
            device_id: deviceId, date,
            task_id: l.taskId, minutes: l.minutes,
            description: l.description || "", timestamp: l.timestamp || new Date().toISOString(),
            category: l.category || "",
          });
        }
      } catch (e) { console.warn("deleteWorkLog Supabase:", e.message); }
    })();
  }, [workLogs, data, revenue, customSchedules]);

  // ── Duration log from popup ───────────────────────────────────────────────
  const logTaskDuration = useCallback((taskId, minutes) => {
    const entry = { taskId, minutes, description: `(auto: ${TASK_BY_ID[taskId]?.label} completed in ${minutes}min)`, timestamp: new Date().toISOString(), category: getTaskCategory(taskId, taskId) };
    const updated = { ...workLogs, [today]: [...(workLogs[today] || []), entry] };
    setWorkLogs(updated);
    saveWorkLog(today, taskId, minutes, entry.description, entry.category).catch(console.error);
    setDurationToast(null);
  }, [workLogs, today]);

  // ── Call log ──────────────────────────────────────────────────────────────
  const logCall = useCallback((callData) => {
    const d = { ...data };
    if (!d.callLogs) d.callLogs = {};
    if (!d.callLogs[today]) d.callLogs[today] = [];
    d.callLogs[today] = [...d.callLogs[today], callData];

    // Only count toward sales_calls task if not a client call
    if ((callData.call_type || "sales") !== "client") {
      const newSalesCalls = (td.sales_calls || 0) + 1;
      d.days = { ...d.days, [today]: { ...td, sales_calls: newSalesCalls } };
      saveTaskValue(today, "sales_calls", newSalesCalls).catch(console.error);
    }

    setData(d);
    logCallToSupabase(today, callData).catch(console.error);
    setCallModal(false);
    setGcalAutoPopup(null);
  }, [data, today, td]);

  // ── Update call ────────────────────────────────────────────────────────────
  const updateCall = useCallback((date, index, newData) => {
    const d = { ...data };
    if (!d.callLogs?.[date]) return;
    const updated = [...d.callLogs[date]];
    updated[index] = { ...updated[index], ...newData };
    d.callLogs = { ...d.callLogs, [date]: updated };
    setData(d);
    writeLocalState({ data: d, revenue, customSchedules });
    updateCallLogsForDate(date, updated).catch(console.error);
    setCallModal(false);
  }, [data, revenue, customSchedules]);

  // ── Delete call ────────────────────────────────────────────────────────────
  const deleteCall = useCallback((date, index) => {
    const d = { ...data };
    if (!d.callLogs?.[date]) return;
    const updated = d.callLogs[date].filter((_, i) => i !== index);
    d.callLogs = { ...d.callLogs, [date]: updated };
    // If we deleted a sales call, decrement sales_calls count
    const deleted = data.callLogs[date][index];
    if ((deleted?.call_type || "sales") !== "client") {
      const cur = d.days?.[date]?.sales_calls || 0;
      if (cur > 0) {
        d.days = { ...d.days, [date]: { ...(d.days[date] || {}), sales_calls: cur - 1 } };
        saveTaskValue(date, "sales_calls", cur - 1).catch(console.error);
      }
    }
    setData(d);
    writeLocalState({ data: d, revenue, customSchedules });
    updateCallLogsForDate(date, updated).catch(console.error);
    setCallModal(false);
  }, [data, revenue, customSchedules]);

  // ── EOD review save ───────────────────────────────────────────────────────
  const saveEOD = useCallback((rating, priorityTomorrow, summary) => {
    const updated = { ...dailyReviews, [today]: { rating, priorityTomorrow, summary } };
    setDailyReviews(updated);
    localStorage.setItem(`deniz-hq-eod-${today}`, "1");
    setShowEOD(false);
    saveDailyReview(today, rating, priorityTomorrow, summary).catch(console.error);
  }, [dailyReviews, today]);

  const savePastEOD = useCallback((date, rating, priorityTomorrow, summary) => {
    const updated = { ...dailyReviews, [date]: { rating, priorityTomorrow, summary } };
    setDailyReviews(updated);
    setPastReviewDate(null);
    saveDailyReview(date, rating, priorityTomorrow, summary).catch(console.error);
  }, [dailyReviews]);

  // ── Test notification ─────────────────────────────────────────────────────
  const sendTestNotification = useCallback(async () => {
    if (!("Notification" in window)) { alert("Notifications not supported in this browser."); return; }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") { alert("Notification permission denied. Please enable notifications for this site in your browser settings."); return; }
    setNotifActive(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("Deniz HQ — Test", {
        body: "Notifications working. You will be reminded every 30 minutes.",
        icon: NOTIF_ICON,
        badge: NOTIF_ICON,
        vibrate: [200, 100, 200],
        tag: "deniz-hq-test",
        renotify: true,
        requireInteraction: false,
      });
    } catch (e) {
      console.warn("[Notif] Test notification failed:", e);
      alert("Could not show notification: " + e.message);
    }
  }, []);

  if (!loaded) return (
    <div style={{ ...S.app, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16 }}>
      <img src={LOGO} alt="" style={{ width:48, height:48, opacity:0.8, borderRadius:12 }} />
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:3, fontWeight:700 }}>LOADING</div>
    </div>
  );

  const progress = todayTasks.length > 0
    ? todayTasks.reduce((s, t) => s + Math.min((td[t.id] || 0) / t.target, 1), 0) / todayTasks.length
    : 0;
  const rank = RANKS[data?.rank || 0];
  const briefingLines = generateBriefingLines(data || {}, today, workLogs, mergedTodaySchedule);

  // Daily performance score (0-100)
  const dailyScore = (() => {
    const taskScore = (() => {
      if (!todayTasks.length) return 25;
      const done = todayTasks.filter(t => (td[t.id]||0) >= t.target).length;
      return Math.round((done / todayTasks.length) * 50);
    })();
    const workScore = (() => {
      const totalLogged = (workLogs[today]||[]).reduce((s,l)=>s+l.minutes,0);
      const target = 300; // 5 hours is a good day
      return Math.min(Math.round((totalLogged / target) * 30), 30);
    })();
    const streakScore = Math.min((data?.streak||0) >= 1 ? 20 : 0, 20);
    return taskScore + workScore + streakScore;
  })();

  const tabs = [
    { id: "home",     label: "Home" },
    { id: "calendar", label: "Calendar" },
    { id: "tasks",    label: "Tasks" },
    { id: "stats",    label: "Stats" },
  ];

  // Calendar week helpers
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const ref = new Date(); ref.setDate(ref.getDate() + weekOffset * 7);
    const mon = new Date(ref); mon.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
  });
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const calDateStr = dateStr(calDate);
  const calSchedule = getScheduleForDate(calDateStr, customSchedules);

  function startEditDay(ds) { setEditingDay(ds); setEditDraft(getScheduleForDate(ds, customSchedules).map(b => ({ ...b }))); }
  async function saveEditDay() {
    const sorted = [...editDraft].sort((a, b) => a.time.localeCompare(b.time));
    setCustomSchedules(prev => ({ ...prev, [editingDay]: sorted }));
    setEditingDay(null);
    await saveCustomSchedule(editingDay, sorted).catch(console.error);
  }

  // Monthly revenue for header display
  const monthAllCalls = Object.entries(data?.callLogs || {}).filter(([d]) => d.startsWith(new Date().toISOString().slice(0,7))).flatMap(([,l]) => l);
  const monthClosed = monthAllCalls.filter(c => c.result === "Closed");
  const monthRevenue = monthClosed.reduce((s, c) => s + (Number(c.value_eur) || 0), 0);

  return (
    <div style={S.app}>
      {/* OVERLAYS */}
      {showBriefing && (
        <MorningBriefing lines={briefingLines} onDismiss={() => { localStorage.setItem(`deniz-hq-briefing-${today}`, "1"); setShowBriefing(false); }} />
      )}
      {showEOD && (
        <EndOfDayReview
          data={data}
          today={today}
          workLogs={workLogs}
          todayTasks={todayTasks}
          existingSummary={dailyReviews?.[today]?.summary || ""}
          onSave={saveEOD}
          onClose={() => { localStorage.setItem(`deniz-hq-eod-${today}`, "1"); setShowEOD(false); }}
        />
      )}
      {pastReviewDate && (
        <EndOfDayReview
          data={data}
          today={pastReviewDate}
          workLogs={workLogs}
          todayTasks={getTodaysTasks(getScheduleForDate(pastReviewDate, customSchedules), TASKS_BY_ID)}
          existingSummary={dailyReviews?.[pastReviewDate]?.summary || ""}
          onSave={(rating, priorityTomorrow, summary) => savePastEOD(pastReviewDate, rating, priorityTomorrow, summary)}
          onClose={() => setPastReviewDate(null)}
        />
      )}
      {callModal !== false && (
        <UnifiedCallModal
          initialData={callModal || {}}
          isEdit={callModal?._isEdit === true}
          recentCalls={Object.values(data?.callLogs || {}).flat().filter(c => (c.call_type||"sales") !== "client")}
          onLog={(callData) => {
            if (callModal?._isEdit) {
              updateCall(callModal._date, callModal._index, callData);
            } else {
              logCall(callData);
            }
          }}
          onDelete={callModal?._isEdit ? () => deleteCall(callModal._date, callModal._index) : undefined}
          onClose={() => setCallModal(false)}
        />
      )}
      {timerTask && timerOpen && (
        <FocusTimerModal
          task={timerTask}
          seconds={timerSecs}
          running={timerRunning}
          onToggle={() => setTimerRunning(r => !r)}
          onReset={() => { setTimerSecs(15 * 60); setTimerRunning(true); }}
          onComplete={(mins, desc) => logWork(timerTask.id, mins, desc)}
          onDone={(mins, desc) => { logWork(timerTask.id, mins, desc); setTimerTask(null); setTimerOpen(false); setTimerRunning(false); }}
          onMinimize={() => setTimerOpen(false)}
          onCancel={() => { setTimerTask(null); setTimerOpen(false); setTimerRunning(false); }}
        />
      )}
      {timerTask && !timerOpen && (
        <FloatingTimerBar task={timerTask} seconds={timerSecs} running={timerRunning}
          onToggle={() => setTimerRunning(r => !r)} onExpand={() => setTimerOpen(true)} />
      )}
      {extraWorkModal && <LogExtraWorkModal onLog={logExtraWork} onClose={() => setExtraWorkModal(false)} />}
      {gcalAutoPopup && (
        <UnifiedCallModal
          initialData={{ title: gcalAutoPopup.title, gcal_event_id: gcalAutoPopup.id, duration_minutes: Math.round((new Date(gcalAutoPopup.end) - new Date(gcalAutoPopup.start))/60000), event_date: gcalAutoPopup.start?.split("T")[0] }}
          recentCalls={Object.values(data?.callLogs||{}).flat().filter(c=>c.call_type!=="client")}
          onLog={(callData) => {
            logCall(callData);
            const prompted = JSON.parse(localStorage.getItem("gcal_prompted") || "[]");
            prompted.push(gcalAutoPopup.id);
            localStorage.setItem("gcal_prompted", JSON.stringify(prompted));
            setGcalAutoPopup(null);
          }}
          onClose={() => {
            const prompted = JSON.parse(localStorage.getItem("gcal_prompted") || "[]");
            prompted.push(gcalAutoPopup.id);
            localStorage.setItem("gcal_prompted", JSON.stringify(prompted));
            setGcalAutoPopup(null);
          }}
        />
      )}
      {classifyModal && (
        <GcalClassifyModal
          ev={classifyModal}
          onSave={() => setClassifyModal(null)}
          onClose={() => setClassifyModal(null)}
        />
      )}
      {fabModal && <QuickAddModal onLog={logExtraWork} onClose={() => setFabModal(false)} />}
      {whatModal && (
        <WhatShouldIDoModal message={getWhatShouldIDo(schedule, td, workLogs, today, todayTasks)} onClose={() => setWhatModal(false)} />
      )}

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <img src={LOGO} alt="Deniz HQ" style={S.logo} />
          <div style={S.headerDivider} />
          <span style={S.headerTitle}>Deniz HQ</span>
        </div>
        <div style={S.headerRight}>
          <div style={S.streakBadge}>{I.fireLg}<span style={{ marginLeft: 4, fontWeight: 700 }}>{data?.streak || 0}</span></div>
          <img src={PHOTO} alt="" style={S.avatar} />
        </div>
      </div>

      {/* CONTENT */}
      <div style={S.content}>

        {/* ── HOME ───────────────────────────────────────────────────────── */}
        {tab === "home" && (
          <>
            {/* Welcome */}
            <div style={S.welcome}>
              <div style={{ ...S.welcomeL1, animation: "fadeIn 0.5s ease both" }}>{getGreeting()}</div>
              <div style={{ ...S.welcomeL2, animation: "slideUp 0.4s 0.3s ease both" }}>
                {computedRevenue > 0
                  ? <span>€{computedRevenue.toLocaleString()} closed this month</span>
                  : <span style={{ cursor: "pointer" }} onClick={() => setEditingRevenue(true)}>
                    {editingRevenue
                      ? <input type="number" autoFocus value={revenue} onChange={e => setRevenue(Number(e.target.value))}
                          onBlur={e => { const v = Number(e.target.value); setRevenue(v); setEditingRevenue(false); saveRevenue(v); }}
                          onKeyDown={e => { if (e.key === "Enter") { const v = Number(e.target.value); setRevenue(v); setEditingRevenue(false); saveRevenue(v); } }}
                          style={{ background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.5)", fontSize: 14, width: 80, outline: "none", padding: "0 2px" }} />
                      : `You're at €${revenue.toLocaleString()} this month`}
                  </span>}
              </div>
              <div style={{ ...S.welcomeL3, animation: "slideUp 0.4s 0.6s ease both" }}>{getContextualMsg(schedule, td, todayTasks)}</div>
            </div>

            {/* Today's focus (priority from yesterday's EOD) */}
            {todayPriority && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(0,200,220,0.06)", border: "1px solid rgba(0,200,220,0.15)", borderRadius: 10, marginBottom: 20 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,220,240,0.8)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(0,220,240,0.5)", marginBottom: 2 }}>Today&apos;s focus</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{todayPriority}</div>
                </div>
              </div>
            )}

            {/* NOW Card */}
            {(() => {
              const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
              const current = mergedTodaySchedule.find(s => {
                const start = parseInt(s.time)*60;
                return nowMin >= start && nowMin < start + s.dur;
              });
              const next = mergedTodaySchedule.find(s => parseInt(s.time)*60 > nowMin);
              const minsToNext = next ? parseInt(next.time)*60 - nowMin : null;

              if (!current && !next) return null;

              const block = current || next;
              const tid = block.taskId || SCHED_TASK_MAP[block.label];
              const task = tid ? TASK_BY_ID[tid] : null;
              const val = task ? (td[tid] || 0) : 0;
              const pct = task ? Math.min(val / task.target, 1) : 0;
              const isCurrent = !!current;

              return (
                <div style={{ marginBottom: 16, padding: "16px", borderRadius: 14, background: isCurrent ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${isCurrent ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}` }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: task ? 10 : 0 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color: isCurrent ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)", textTransform:"uppercase", marginBottom:3 }}>
                        {isCurrent ? "NOW" : `NEXT — ${minsToNext}min`}
                      </div>
                      <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{block.label}</div>
                      {task && (
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
                          {task.unit === "min"
                            ? `${formatMin(val)} / ${formatMin(task.target)} logged`
                            : `${val} / ${task.target} ${task.unit}`}
                        </div>
                      )}
                    </div>
                    {task && (
                      task.unit === "min" ? (
                        <button style={{ ...S.startBtn, padding:"10px 18px", fontSize:13, fontWeight:800, borderColor: isCurrent ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)" }}
                          onClick={() => { setTimerTask(task); setTimerSecs(15*60); setTimerRunning(false); setTimerOpen(true); }}>
                          {isCurrent ? "Focus" : "Start"}
                        </button>
                      ) : (
                        <button style={{ ...S.qBtnDone, padding:"10px 18px", fontSize:12 }}
                          onClick={() => updateTask(tid, val + (task.unit==="reps"?25:1))}>
                          +{task.unit==="reps"?25:1}
                        </button>
                      )
                    )}
                  </div>
                  {task && pct > 0 && (
                    <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.05)", marginTop:8 }}>
                      <div style={{ height:"100%", borderRadius:2, width:`${pct*100}%`, background: pct>=1?"#4ADE80":"rgba(255,255,255,0.6)", transition:"width 0.3s ease" }} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Progress ring */}
            <div style={S.progressSection}>
              <svg viewBox="0 0 120 120" width="100" height="100">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
                <circle cx="60" cy="60" r="52" fill="none" stroke={progress >= 1 ? "#4ADE80" : "#fff"} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${progress * 326.7} 326.7`} transform="rotate(-90 60 60)" style={{ transition: "stroke-dasharray 0.6s" }}/>
                <text x="60" y="64" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="800" fontFamily="inherit">{Math.round(progress * 100)}%</text>
              </svg>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Today&apos;s execution</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Rank: <span style={{ color: rank.color, fontWeight: 700 }}>{rank.name}</span></div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{I.fireLg} {data?.streak || 0} day streak</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Score: <span style={{ fontWeight: 800, color: dailyScore >= 71 ? "#4ADE80" : dailyScore >= 41 ? "#FBBF24" : "#EF4444" }}>{dailyScore}</span><span style={{ color: "rgba(255,255,255,0.3)" }}>/100</span>
                </div>
              </div>
            </div>

            {/* Schedule — read-only */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ ...S.sectionLabel, marginBottom:0 }}>Schedule</div>
              <button onClick={() => { setTab("calendar"); setCalDate(new Date()); setTimeout(() => startEditDay(today), 100); }}
                style={{ fontSize:10, color:"rgba(255,255,255,0.3)", background:"transparent", border:"none", cursor:"pointer", fontWeight:600, letterSpacing:0.5, padding:"4px 8px" }}>
                EDIT
              </button>
            </div>
            {mergedTodaySchedule.map((s, i) => {
              const isGcal = s.source === "google";
              const status = isGcal ? (s.taskType === "display" ? "display" : getSchedStatus(s, td)) : getSchedStatus(s, td);
              return (
                <div key={i} style={{ ...S.schedRow, ...(status==="now"?S.schedNow:{}), ...(status==="done"?S.schedDone:{}), ...(status==="missed"?S.schedMissed:{}), ...(isGcal ? { borderLeft: "3px solid rgba(66,133,244,0.6)", paddingLeft: 10 } : {}) }}>
                  <div style={{ ...S.schedTime, color: status==="missed"?"rgba(239,68,68,0.5)":status==="now"?"#fff":status==="done"?"rgba(74,222,128,0.7)":"rgba(255,255,255,0.3)" }}>
                    <span>{s.time}</span>
                    {status==="now"    && <span style={S.nowPill}>NOW</span>}
                    {status==="missed" && <span style={S.missedPill}>MISSED</span>}
                  </div>
                  <div style={{ ...S.schedName, flex: 1, opacity: status==="missed"?0.45:1, display:"flex", alignItems:"center", gap:5 }}>
                    {isGcal && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(66,133,244,0.8)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                    {s.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={S.schedDur}>{formatTime(s.dur)}</div>
                    {status==="done" && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </div>
              );
            })}

            {/* Quick Log — driven by todayTasks so labels/targets always match the calendar */}
            <div style={{ ...S.sectionLabel, marginTop: 24 }}>Quick Log</div>
            {todayTasks.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "12px 0" }}>No trackable tasks in today&apos;s schedule</div>
            )}
            {(() => {
              // Build a map from task ID → schedule block for status/timing lookups
              const blockByTaskId = {};
              for (const s of schedule) {
                const tid = s.taskId || SCHED_TASK_MAP[s.label] || s.blockId;
                if (tid && !blockByTaskId[tid]) blockByTaskId[tid] = s;
              }
              const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
              return todayTasks.map(task => {
                const v = td[task.id] || 0;
                const todayMinLogs = task.unit === "min"
                  ? (workLogs[today] || []).filter(l => l.taskId === task.id).reduce((sum, l) => sum + l.minutes, 0)
                  : v;
                const displayVal = task.unit === "min" ? todayMinLogs : v;
                const pct = Math.min(displayVal / task.target, 1);
                const done = pct >= 1;
                const streak = taskStreaks[task.id] || 0;
                const sBlock = blockByTaskId[task.id];
                const status = sBlock ? getSchedStatus(sBlock, td) : "upcoming";
                const blockEnd = sBlock ? parseInt(sBlock.time) * 60 + sBlock.dur : Infinity;
                const streakAtRisk = !done && streak > 0 && nowMin > blockEnd;
                const increment = task.unit === "reps" ? 25 : task.unit === "sent" ? 10 : 1;
                return (
                  <div key={task.id} style={{ ...S.taskRow, ...(done ? S.taskRowDone : {}) }}>
                    <div style={S.taskLeft}>
                      <div style={S.taskIcon}>{task.icon}</div>
                      <div>
                        <div style={{ ...S.taskName, display: "flex", alignItems: "center", gap: 6 }}>
                          {task.label}
                          {streak > 0 && <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, fontWeight: 700, color: streakAtRisk ? "#EF4444" : "rgba(255,255,255,0.35)" }}>
                            {I.fire}{streak}
                          </span>}
                        </div>
                        <div style={S.taskSub}>
                          {task.unit === "min" ? formatMin(displayVal) : displayVal} / {task.unit === "min" ? formatMin(task.target) : `${task.target} ${task.unit}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      {done ? (
                        <span style={S.taskCheck}>{I.check}</span>
                      ) : task.unit === "min" ? (
                        <button style={{ ...S.startBtn, ...(status==="now"?{borderColor:"rgba(255,255,255,0.3)"}:{}) }} onClick={() => { setTimerTask(task); setTimerSecs(15*60); setTimerRunning(false); setTimerOpen(true); }}>Start</button>
                      ) : (
                        <div style={S.taskBtns}>
                          <button style={S.qBtn} onClick={() => updateTask(task.id, v + increment)}>+{increment}</button>
                          <button style={S.qBtnDone} onClick={() => updateTask(task.id, task.target)}>{I.check}</button>
                        </div>
                      )}
                    </div>
                    <div style={S.taskBar}><div style={{ ...S.taskBarFill, width: `${pct*100}%`, background: done?"#4ADE80":"#fff" }}/></div>
                  </div>
                );
              });
            })()}

            {/* GCal call events — quick log */}
            {(gcalEventsByDate[today] || []).filter(ev => ev.isCallEvent).map(ev => {
              const alreadyLogged = (data?.callLogs?.[today] || []).some(c => c.gcal_event_id === ev.id || c.gcalId === ev.id);
              return (
                <div key={ev.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:"rgba(66,133,244,0.08)", border:"1px solid rgba(66,133,244,0.2)", marginTop:8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(66,133,244,0.9)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontWeight:600 }}>{ev.title}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:1 }}>{new Date(ev.start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                  {alreadyLogged ? (
                    <span style={{ fontSize:11, color:"rgba(74,222,128,0.7)" }}>Logged ✓</span>
                  ) : (
                    <button style={{ ...S.qBtnDone, fontSize:10, padding:"4px 10px" }} onClick={() => setCallModal({ title: ev.title, gcal_event_id: ev.id, duration_minutes: Math.round((new Date(ev.end) - new Date(ev.start))/60000), event_date: ev.start?.split("T")[0] })}>Log Call</button>
                  )}
                </div>
              );
            })}

            {/* Log Extra Work */}
            <button style={{ ...S.logCallBtn, marginTop: 8, color: "rgba(0,200,220,0.5)", borderColor: "rgba(0,200,220,0.1)" }} onClick={() => setExtraWorkModal(true)}>
              {I.plus} <span style={{ marginLeft: 8 }}>Log Extra Work</span>
            </button>

            {/* Log Call */}
            <button style={S.logCallBtn} onClick={() => setCallModal({})}>
              {I.phone} <span style={{ marginLeft: 8 }}>Log Sales Call</span>
            </button>

            {/* Today's Calls */}
            {(data?.callLogs?.[today] || []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={S.sectionLabel}>Call Log</div>
                {data.callLogs[today].map((c, i) => (
                  <div key={i} style={{ ...S.callLogRow, cursor: "pointer" }} onClick={() => setCallModal({ _isEdit: true, _date: today, _index: i, ...c })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.result==="Closed"?"#4ADE80":c.result==="Not Closed"?"#EF4444":"rgba(255,255,255,0.7)" }}>
                        {c.result}{c.value_eur > 0 && ` — €${Number(c.value_eur).toLocaleString()}`}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{c.time}</span>
                        <span style={{ color: "rgba(255,255,255,0.3)", padding: 2 }}>{I.pencil}</span>
                      </div>
                    </div>
                    {c.notes && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{c.notes}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Status + actions footer */}
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: notifActive ? "#4ADE80" : "#EF4444", display: "inline-block" }}/>
                <span style={{ fontSize: 10, color: notifActive ? "rgba(74,222,128,0.6)" : "rgba(239,68,68,0.5)", fontWeight: 600 }}>
                  {notifActive ? "Notifications active" : "Notifications off"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 11, cursor: "pointer", padding: 0 }}
                  onClick={() => setShowEOD(true)}>End-of-day review</button>
                <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 11, cursor: "pointer", padding: 0 }}
                  onClick={sendTestNotification}>Test notif</button>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", marginTop: 8, textAlign: "center" }}>
              Keep the app open for reliable 30-min notifications
            </div>
          </>
        )}

        {/* ── CALENDAR ───────────────────────────────────────────────────── */}
        {tab === "calendar" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={S.sectionLabel}>Calendar</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setWeekOffset(w => w - 1)} style={S.iconBtn}>{I.chevL}</button>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", minWidth: 80, textAlign: "center" }}>
                  {weekOffset===0?"This week":weekOffset===-1?"Last week":weekOffset===1?"Next week":`Week ${weekOffset>0?"+":""}${weekOffset}`}
                </span>
                <button onClick={() => setWeekOffset(w => w + 1)} style={S.iconBtn}>{I.chevR}</button>
                {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ ...S.iconBtn, fontSize: 10, padding: "4px 8px", color: "rgba(255,255,255,0.5)" }}>Today</button>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {weekDates.map((d, i) => {
                const key = dateStr(d), isToday = key===today, isSel = key===calDateStr, dayDone = data?.days?.[key]?._done;
                const hasGcalEvents = (gcalEventsByDate[key] || []).length > 0;
                return (
                  <button key={i} onClick={() => setCalDate(d)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"6px 0", borderRadius:8, background:isSel?"rgba(255,255,255,0.08)":"transparent", border:isToday?"1px solid rgba(255,255,255,0.2)":"1px solid transparent", cursor:"pointer", color:"#fff" }}>
                    <span style={{ fontSize:9, fontWeight:600, color:"rgba(255,255,255,0.3)" }}>{DAYS[d.getDay()]}</span>
                    <span style={{ fontSize:14, fontWeight:700 }}>{d.getDate()}</span>
                    {dayDone ? (
                      <span style={{ width:5, height:5, borderRadius:"50%", background:"#4ADE80" }}/>
                    ) : hasGcalEvents ? (
                      <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(66,133,244,0.8)" }}/>
                    ) : (
                      <span style={{ width:5, height:5 }}/>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={S.sectionLabel}>
                {calDateStr===today?"Today":DAYS[calDate.getDay()]+" "+calDate.getDate()}
                {customSchedules[calDateStr] && <span style={{ marginLeft:6, fontSize:9, color:"rgba(0,200,220,0.7)", fontWeight:700 }}>CUSTOM</span>}
              </div>
              {editingDay !== calDateStr && (
                <div style={{ display:"flex", gap:6 }}>
                  {customSchedules[calDateStr] && (
                    <button onClick={async () => {
                      const newCS = { ...customSchedules };
                      delete newCS[calDateStr];
                      setCustomSchedules(newCS);
                      await deleteCustomSchedule(calDateStr).catch(console.error);
                    }} style={{ ...S.editBtn, fontSize:10, color:"rgba(239,68,68,0.6)", borderColor:"rgba(239,68,68,0.15)" }}>Revert</button>
                  )}
                  <button onClick={() => startEditDay(calDateStr)} style={S.editBtn}>{I.pencil}<span style={{ marginLeft:4 }}>Edit</span></button>
                </div>
              )}
            </div>
            {editingDay === calDateStr ? (
              <ScheduleEditor draft={editDraft} onChange={setEditDraft} onSave={saveEditDay} onCancel={() => setEditingDay(null)} />
            ) : (
              <>
                {(() => {
                  const calDayGcalEvents = gcalEventsByDate[calDateStr] || [];
                  const calMergedSchedule = (() => {
                    const gcalBlocks = calDayGcalEvents.map(ev => ({
                      ...eventToScheduleBlock(ev),
                      _gcalEv: ev,
                      _classification: getGcalEventClassification(ev.id),
                    }));
                    const manualTimes = new Set(calSchedule.map(s => s.time));
                    const newBlocks = gcalBlocks.filter(b => !manualTimes.has(b.time));
                    return [...calSchedule.map(s => ({ ...s, _gcalEv: null })), ...newBlocks].sort((a, b) => {
                      const toMins = t => { const [h,m]=(t||"00:00").split(":"); return parseInt(h)*60+parseInt(m||0); };
                      return toMins(a.time) - toMins(b.time);
                    });
                  })();
                  return calMergedSchedule.map((s, i) => {
                    if (!s._gcalEv) {
                      const blockTask = s.taskId ? TASK_BY_ID[s.taskId] : null;
                      const isCounter = blockTask ? blockTask.unit !== "min" : s.customType === "counter";
                      const blockTarget = s.target ?? blockTask?.target;
                      const blockUnit = s.unit || blockTask?.unit || "";
                      return (
                        <div key={i} style={S.schedRow}>
                          <div style={S.schedTime}><span>{s.time}</span></div>
                          <div style={S.schedName}>{s.label}</div>
                          <div style={{ ...S.schedDur, display:"flex", alignItems:"center", gap:4 }}>
                            {isCounter && blockTarget != null ? (
                              <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:700 }}>{blockTarget} {blockUnit}</span>
                            ) : (
                              <>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>{formatTime(s.dur)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }
                    const ev = s._gcalEv;
                    const cls = s._classification;
                    const borderColor = cls === "sales" ? "#3B82F6" : cls === "client" ? "#8B5CF6" : cls === "rescheduled" ? "#F59E0B" : "rgba(255,255,255,0.2)";
                    return (
                      <div key={i} style={{ ...S.schedRow, borderLeft:`3px solid ${borderColor}`, paddingLeft:10, marginBottom:4 }}>
                        <div style={S.schedTime}>
                          <span>{ev.start ? new Date(ev.start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : s.time}</span>
                        </div>
                        <div style={{ ...S.schedName, flex:1, display:"flex", alignItems:"center", gap:6 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(66,133,244,0.8)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <span style={{ flex:1 }}>{ev.title}</span>
                          {ev.calendarName && <span style={{ fontSize:9, color:"rgba(66,133,244,0.6)", fontWeight:600 }}>{ev.calendarName}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          {ev.isCallEvent && (
                            <button onClick={() => setClassifyModal(ev)}
                              style={{ padding:"2px 6px", borderRadius:4, background: cls ? `${borderColor}20` : "rgba(66,133,244,0.1)", border:`1px solid ${borderColor}40`, color: borderColor, fontSize:9, cursor:"pointer" }}>
                              {cls || "tag"}
                            </button>
                          )}
                          {ev.end && ev.start && <div style={S.schedDur}>{formatTime(Math.round((new Date(ev.end) - new Date(ev.start))/60000))}</div>}
                        </div>
                      </div>
                    );
                  });
                })()}
                {data?.days?.[calDateStr] && (
                  <>
                    <div style={{ ...S.sectionLabel, marginTop:16 }}>Activity</div>
                    {DEFAULT_TASKS.map(t => {
                      const v = data.days[calDateStr]?.[t.id]||0; if (!v) return null;
                      return <div key={t.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", fontSize:13 }}><span>{t.label}</span><span style={{ fontWeight:700 }}>{v}/{t.target}</span></div>;
                    })}
                  </>
                )}
              </>
            )}

            {/* Google Calendar */}
            <div style={{ marginTop:24, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
              <button
                onClick={async () => {
                  console.log("[GCal] Button clicked. connected=", gcalConnected);
                  setGcalError(null);
                  if (gcalConnected) {
                    await disconnectGoogleCalendar();
                    setGcalConnected(false);
                    return;
                  }
                  setGcalLoading(true);
                  try {
                    const token = await connectGoogleCalendar();
                    console.log("[GCal] UI: connected, token:", token?.substring(0, 20) + "...");
                    restoreGcalToken(token);
                    setGcalConnected(true);
                    await fetchGcalEvents();
                  } catch (e) {
                    console.error("[GCal] Connect failed:", e);
                    const msg = e?.message || String(e);
                    setGcalError(msg);
                    alert("Google Calendar error:\n" + msg + "\n\nCheck browser console for details. Make sure https://deniz-hq.netlify.app is added as an Authorized JavaScript Origin in Google Cloud Console.");
                  } finally {
                    setGcalLoading(false);
                  }
                }}
                style={{ ...S.logCallBtn, color: gcalConnected?"rgba(74,222,128,0.7)":gcalLoading?"rgba(255,200,50,0.7)":"rgba(255,255,255,0.35)", borderColor: gcalConnected?"rgba(74,222,128,0.15)":"rgba(255,255,255,0.06)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span style={{ marginLeft:8 }}>
                  {gcalLoading ? "Opening Google auth..." : gcalConnected ? "Google Calendar connected — tap to disconnect" : "Connect Google Calendar"}
                </span>
              </button>
              {gcalError && (
                <div style={{ marginTop:8, padding:"8px 10px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, fontSize:11, color:"rgba(239,68,68,0.8)", lineHeight:1.5 }}>
                  {gcalError}
                </div>
              )}
              {!gcalConnected && !gcalError && (
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginTop:6, textAlign:"center" }}>
                  Add <strong>https://deniz-hq.netlify.app</strong> as an Authorized JS Origin in Google Cloud Console
                </div>
              )}
              {/* Debug button — temporary */}
              {gcalConnected && (
                <button onClick={async () => {
                  const token = localStorage.getItem("gcal_token");
                  if (!token) { console.log("[GCal Debug] No token in localStorage"); return; }
                  console.log("[GCal Debug] Token found:", token.substring(0, 20) + "...");

                  // List ALL calendars
                  console.log("[GCal Debug] Fetching calendar list...");
                  const calRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
                    headers: { Authorization: "Bearer " + token }
                  });
                  const calData = await calRes.json();
                  console.log("[GCal Debug] All calendars:", JSON.stringify(
                    calData.items?.map(c => ({ id: c.id, summary: c.summary, primary: c.primary }))
                  ));

                  // Fetch events from each calendar for next 7 days
                  const now = new Date();
                  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                  for (const cal of (calData.items || [])) {
                    const evRes = await fetch(
                      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${now.toISOString()}&timeMax=${weekFromNow.toISOString()}&singleEvents=true&orderBy=startTime`,
                      { headers: { Authorization: "Bearer " + token } }
                    );
                    const evData = await evRes.json();
                    console.log(`[GCal Debug] "${cal.summary}" (${cal.id}): ${evData.items?.length || 0} events`);
                    (evData.items || []).forEach(e => {
                      console.log(`[GCal Debug]   - "${e.summary}" at ${e.start?.dateTime || e.start?.date} | desc: ${(e.description || "").substring(0, 100)}`);
                    });
                  }
                  alert("Debug complete — check browser console (F12)");
                }} style={{ ...S.logCallBtn, marginTop:8, color:"rgba(255,200,50,0.6)", borderColor:"rgba(255,200,50,0.12)" }}>
                  Debug Calendar (check console)
                </button>
              )}
            </div>
          </>
        )}

        {/* ── TASKS ──────────────────────────────────────────────────────── */}
        {tab === "tasks" && (
          <>
            <div style={S.sectionLabel}>Execution Checklist — Today</div>
            {todayTasks.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "24px 0" }}>No trackable tasks in today&apos;s schedule</div>
            )}
            {todayTasks.map(t => {
              const v = td[t.id]||0, done = v>=t.target, streak = taskStreaks[t.id]||0;
              const isDefaultTask = DEFAULT_TASKS.some(d => d.id === t.id);
              return (
                <div key={t.id} style={{ ...S.checkRow, ...(done?S.checkDone:{}) }}>
                  <div style={S.checkLeft}>
                    <div style={{ ...S.checkBox, ...(done?S.checkBoxDone:{}) }} onClick={() => updateTask(t.id, done?0:t.target)}>{done && I.check}</div>
                    <div>
                      <div style={{ ...S.checkLabel, gap:8 }}>
                        {t.icon} {t.label}
                        {streak > 0 && <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.35)", display:"flex", alignItems:"center", gap:2 }}>{I.fire}{streak}</span>}
                      </div>
                      <div style={{ ...S.checkTarget, display:"flex", alignItems:"center", gap:6 }}>
                        Target:
                        {isDefaultTask ? (
                          <input type="number" value={customTargets[t.id] ?? t.target} min="1"
                            onChange={e => { const n = Number(e.target.value); if (n > 0) saveCustomTargets({ ...customTargets, [t.id]: n }); }}
                            style={{ width:52, padding:"1px 4px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:4, color:"rgba(255,255,255,0.7)", fontSize:11, outline:"none", textAlign:"center" }} />
                        ) : (
                          <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:700 }}>{t.target}</span>
                        )}
                        {t.unit}
                      </div>
                    </div>
                  </div>
                  <input type="number" style={S.checkInput} value={v||""} placeholder="0" onChange={e => updateTask(t.id, e.target.value)} />
                </div>
              );
            })}
          </>
        )}

        {/* ── STATS ──────────────────────────────────────────────────────── */}
        {tab === "stats" && (
          <>
            {/* Stats sub-nav */}
            <div style={{ display:"flex", gap:4, marginBottom:16, background:"rgba(255,255,255,0.03)", borderRadius:10, padding:3 }}>
              {[["daily","Daily Logs"],["productivity","Breakdown"],["performance","Metrics"]].map(([v,l]) => (
                <button key={v} onClick={() => setStatsView(v)} style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background:statsView===v?"rgba(255,255,255,0.08)":"transparent", color:statsView===v?"#fff":"rgba(255,255,255,0.35)", fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:0.5 }}>{l}</button>
              ))}
            </div>

            {/* 30-day habit grid */}
            {statsView === "daily" && (() => {
              const last30 = [];
              for (let i = 29; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                last30.push(d.toISOString().split("T")[0]);
              }
              const keyTasks = [
                { id: "ig_outreach", label: "DMs", target: 50, color: "#60A5FA" },
                { id: "pushups", label: "Pushups", target: 200, color: "#4ADE80" },
                { id: "client_work", label: "Client", target: 120, color: "#A78BFA" },
                { id: "ceo_work", label: "CEO", target: 120, color: "#FBBF24" },
                { id: "content", label: "Content", target: 60, color: "#F472B6" },
              ];
              return (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ ...S.sectionLabel, marginBottom: 10 }}>30-Day Habit Grid</div>
                  {keyTasks.map(task => {
                    const streak = (() => {
                      let s = 0;
                      const d = new Date(); d.setDate(d.getDate() - 1);
                      for (let i = 0; i < 30; i++) {
                        const ds = d.toISOString().split("T")[0];
                        if ((data?.days?.[ds]?.[task.id] || 0) >= task.target) { s++; d.setDate(d.getDate()-1); }
                        else break;
                      }
                      return s;
                    })();
                    return (
                      <div key={task.id} style={{ marginBottom: 8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", width:44, flexShrink:0 }}>{task.label}</div>
                          <div style={{ display:"flex", gap:2, flex:1 }}>
                            {last30.map(ds => {
                              const val = data?.days?.[ds]?.[task.id] || 0;
                              const pct = Math.min(val / task.target, 1);
                              return (
                                <div key={ds} title={`${ds}: ${val}/${task.target}`}
                                  style={{ flex:1, height:14, borderRadius:2,
                                    background: pct >= 1 ? task.color : pct > 0 ? `${task.color}55` : "rgba(255,255,255,0.04)" }} />
                              );
                            })}
                          </div>
                          {streak > 0 && <div style={{ fontSize:10, fontWeight:700, color:task.color, width:28, textAlign:"right", flexShrink:0, display:"flex", alignItems:"center", gap:2 }}>{streak}{I.fire}</div>}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display:"flex", gap:2, marginTop:4, paddingLeft:52 }}>
                    {[0,14,29].map(i => (
                      <div key={i} style={{ flex:1, fontSize:8, color:"rgba(255,255,255,0.2)", textAlign: i===0?"left":i===14?"center":"right" }}>
                        {(() => { const d = new Date(); d.setDate(d.getDate()-29+i); return `${d.getDate()}/${d.getMonth()+1}`; })()}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── SECTION A: Daily Logs ── */}
            {statsView === "daily" && (() => {
              const sd = dateStr(statsDate);
              const sdTasks = getTodaysTasks(getScheduleForDate(sd, customSchedules));
              const sdData = data?.days?.[sd] || {};
              const sdWL = workLogs?.[sd] || [];
              const sdCalls = data?.callLogs?.[sd] || [];
              const sdReview = dailyReviews?.[sd];
              const totalMins = sdWL.reduce((s, l) => s + (l.minutes || 0), 0);
              function navDay(dir) {
                const d = new Date(statsDate); d.setDate(d.getDate() + dir); setStatsDate(d);
              }
              return (
                <>
                  {/* Date nav */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <button onClick={() => navDay(-1)} style={S.iconBtn}>{I.chevL}</button>
                    <span style={{ fontSize:13, fontWeight:700 }}>
                      {sd === today ? "Today" : new Date(sd + "T12:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })}
                    </span>
                    <button onClick={() => navDay(1)} style={{ ...S.iconBtn, opacity: sd >= today ? 0.3 : 1 }} disabled={sd >= today}>{I.chevR}</button>
                  </div>

                  {/* Total bar */}
                  {totalMins > 0 && (
                    <div style={{ ...S.chartCard, marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>Total work time</span>
                      <span style={{ fontSize:20, fontWeight:800, color:"#4ADE80" }}>{formatMin(totalMins)}</span>
                    </div>
                  )}

                  {/* Review button — always visible for past days */}
                  {sd !== today && (
                    <div style={{ marginBottom:12, display:"flex", justifyContent:"flex-end" }}>
                      <button
                        onClick={() => setPastReviewDate(sd)}
                        style={{ fontSize:11, fontWeight:700, color: sdReview ? "rgba(255,255,255,0.4)" : "#4ADE80", background:"transparent", border:`1px solid ${sdReview ? "rgba(255,255,255,0.1)" : "rgba(74,222,128,0.3)"}`, borderRadius:6, padding:"5px 12px", cursor:"pointer", letterSpacing:0.5 }}
                      >
                        {sdReview ? "EDIT REVIEW" : "+ ADD REVIEW"}
                      </button>
                    </div>
                  )}

                  {/* Day review — summary, rating, priority */}
                  {sdReview && (
                    <>
                      {sdReview.summary && (
                        <div style={{ marginBottom:10, padding:"10px 12px", background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)", letterSpacing:1, marginBottom:4 }}>SUMMARY</div>
                          <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.5 }}>{sdReview.summary}</div>
                        </div>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                        {[1,2,3,4,5].map(s => <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={s<=sdReview.rating?"#FFD700":"none"} stroke={s<=sdReview.rating?"#FFD700":"rgba(255,255,255,0.2)"} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
                        {sdReview.priorityTomorrow && <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginLeft:6 }}>→ {sdReview.priorityTomorrow}</span>}
                      </div>
                    </>
                  )}

                  {/* Tasks */}
                  {sdTasks.map(t => {
                    const val = sdData[t.id] || 0;
                    const done = val >= t.target;
                    const logs = sdWL.filter(l => l.taskId === t.id);
                    const mins = logs.reduce((s, l) => s + l.minutes, 0);
                    const displayVal = t.unit === "min" ? mins : val;
                    return (
                      <div key={t.id} style={{ padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: logs.length > 0 ? 6 : 0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {done
                              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                            <span style={{ fontSize:13, fontWeight:600, color: done?"#fff":"rgba(255,255,255,0.5)" }}>{t.label}</span>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color: done?"#4ADE80":"rgba(255,255,255,0.3)" }}>
                            {t.unit === "min" ? formatMin(displayVal) : `${displayVal}/${t.target}`}
                          </span>
                        </div>
                        {logs.map((l, li) => {
                          const globalIndex = sdWL.indexOf(l);
                          return (
                            <div key={li} style={{ fontSize:11, color:"rgba(255,255,255,0.3)", paddingLeft:20, marginTop:2, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                              <span>• {formatMin(l.minutes)}{l.description ? ` — ${l.description}` : ""}</span>
                              <button onClick={() => deleteWorkLog(sd, globalIndex)} style={{ background:"none", border:"none", color:"rgba(239,68,68,0.4)", cursor:"pointer", padding:"0 4px", fontSize:12, lineHeight:1 }}>×</button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Extra work */}
                  {sdWL.filter(l => l.taskId === "_extra").length > 0 && (
                    <>
                      <div style={{ ...S.sectionLabel, marginTop:12 }}>Extra Work</div>
                      {sdWL.filter(l => l.taskId === "_extra").map((l, i) => {
                        const globalIndex = sdWL.indexOf(l);
                        return (
                          <div key={i} style={{ padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", fontSize:12 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <span style={{ fontWeight:600 }}>{l.label || l.description}</span>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ color:"rgba(255,255,255,0.4)" }}>{formatMin(l.minutes)}</span>
                                <button onClick={() => deleteWorkLog(sd, globalIndex)} style={{ background:"none", border:"none", color:"rgba(239,68,68,0.4)", cursor:"pointer", padding:"0 4px", fontSize:14, lineHeight:1 }}>×</button>
                              </div>
                            </div>
                            {l.category && <div style={{ fontSize:10, color: CAT_COLORS[l.category] || "rgba(255,255,255,0.3)", marginTop:2 }}>{l.category}</div>}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Calls */}
                  {sdCalls.length > 0 && (
                    <>
                      <div style={{ ...S.sectionLabel, marginTop:12 }}>Calls</div>
                      {sdCalls.map((c, i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", cursor:"pointer" }} onClick={() => setCallModal({ _isEdit: true, _date: sd, _index: i, ...c })}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:12, fontWeight:600, color: c.result==="Closed"?"#4ADE80":c.result==="Not Closed"?"#EF4444":"rgba(255,255,255,0.7)" }}>{c.result}</span>
                            {c.notes && <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{c.notes}</span>}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {c.value_eur > 0 && <span style={{ fontSize:12, fontWeight:700, color:"#4ADE80" }}>€{Number(c.value_eur).toLocaleString()}</span>}
                            <span style={{ color:"rgba(255,255,255,0.3)", padding:2 }}>{I.pencil}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {sdTasks.length === 0 && sdWL.length === 0 && sdCalls.length === 0 && (
                    <div style={{ textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:13, padding:"40px 0" }}>No data logged for this day</div>
                  )}
                </>
              );
            })()}

            {/* ── SECTION B: Productivity Breakdown ── */}
            {statsView === "productivity" && (() => {
              const allWorkKeys = Object.keys(workLogs || {});
              const prodData = computeProductivity(workLogs, data?.days, statsPeriod, today, allWorkKeys, data?.callLogs);
              const totalMins = Object.values(prodData).reduce((s, v) => s + v, 0);
              const periods = [["today","Today"],["week","Week"],["month","Month"],["alltime","All Time"]];
              return (
                <>
                  {/* Period toggle */}
                  <div style={{ display:"flex", gap:4, marginBottom:16, background:"rgba(255,255,255,0.03)", borderRadius:10, padding:3 }}>
                    {periods.map(([v,l]) => (
                      <button key={v} onClick={() => setStatsPeriod(v)} style={{ flex:1, padding:"6px 0", borderRadius:8, border:"none", background:statsPeriod===v?"rgba(255,255,255,0.08)":"transparent", color:statsPeriod===v?"#fff":"rgba(255,255,255,0.3)", fontSize:10, fontWeight:700, cursor:"pointer" }}>{l}</button>
                    ))}
                  </div>

                  {/* Headline + donut */}
                  {(() => {
                    const activeDaysInRange = (() => {
                      const range = getStatsDateRange(statsPeriod === "alltime" ? "all" : statsPeriod);
                      const { workLogs: wl = {}, callLogs: cl = {} } = data || {};
                      const activeDays = new Set();
                      for (const [date, logs] of Object.entries(wl)) {
                        if (date >= range.start && date <= range.end && logs.length > 0) activeDays.add(date);
                      }
                      for (const [date, logs] of Object.entries(cl)) {
                        if (date >= range.start && date <= range.end && logs.some(l => l.duration_minutes > 0)) activeDays.add(date);
                      }
                      return activeDays.size;
                    })();
                    const statsTotalMins = getTotalProductiveMinutes(statsPeriod === "alltime" ? "all" : statsPeriod, { workLogs: workLogs || {}, callLogs: data?.callLogs || {} });
                    const avgPerDay = activeDaysInRange > 0 ? Math.round(statsTotalMins / activeDaysInRange) : 0;
                    return (
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:20 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:24, width:"100%" }}>
                          <DonutChart data={prodData} size={140} />
                          <div style={{ flex:1 }}>
                            {Object.entries(CAT_COLORS).map(([cat, color]) => {
                              const mins = prodData[cat] || 0;
                              const pct = totalMins > 0 ? Math.round(mins / totalMins * 100) : 0;
                              if (mins === 0) return null;
                              return (
                                <div key={cat} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                                  <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }}/>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.7)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cat}</div>
                                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>{formatMin(mins)} · {pct}%</div>
                                  </div>
                                </div>
                              );
                            })}
                            {totalMins === 0 && <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>No work logged yet</div>}
                          </div>
                        </div>
                        {activeDaysInRange > 0 && (
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:4, textAlign:"center" }}>
                            Avg: {formatMin(avgPerDay)}/day ({activeDaysInRange} active days)
                          </div>
                        )}
                        {statsPeriod === "month" && activeDaysInRange >= 7 && (
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2, textAlign:"center" }}>
                            {formatMin(avgPerDay * 7)}/week avg
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Category breakdown bars */}
                  {Object.entries(CAT_COLORS).map(([cat, color]) => {
                    const mins = prodData[cat] || 0;
                    if (mins === 0) return null;
                    const pct = totalMins > 0 ? mins / totalMins : 0;
                    return (
                      <div key={cat} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:600 }}>{cat}</span>
                          <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{formatMin(mins)}</span>
                        </div>
                        <div style={{ height:6, background:"rgba(255,255,255,0.04)", borderRadius:3 }}>
                          <div style={{ height:"100%", width:`${pct*100}%`, background:color, borderRadius:3, transition:"width 0.4s" }}/>
                        </div>
                      </div>
                    );
                  })}

                  {/* Work entries */}
                  {Object.entries(workLogs || {}).filter(([d]) => {
                    if (statsPeriod === "today") return d === today;
                    if (statsPeriod === "week") { const keys = getDateRangeKeys("week", today); return keys && keys.includes(d); }
                    if (statsPeriod === "month") return d.startsWith(today.slice(0,7));
                    return true;
                  }).sort(([a],[b]) => b.localeCompare(a)).slice(0,3).map(([date, logs]) => (
                    <div key={date} style={{ marginTop:8 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.25)", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>
                        {new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                      </div>
                      {logs.map((l, i) => (
                        <div key={i} style={{ fontSize:11, color:"rgba(255,255,255,0.4)", padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", display:"flex", justifyContent:"space-between" }}>
                          <span>{l.taskId === "_extra" ? (l.label || "Extra work") : (TASK_BY_ID[l.taskId]?.label || l.taskId)}</span>
                          <span>{formatMin(l.minutes)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              );
            })()}

            {/* ── SECTION C: Performance Metrics ── */}
            {statsView === "performance" && (() => {
              const perfPeriods = [["week","This Week"],["month","This Month"],["alltime","All Time"]];
              const allData = { days: data?.days || {}, callLogs: data?.callLogs || {}, workLogs };
              const funnel = getSalesFunnel(statsPeriod === "alltime" ? "all" : statsPeriod, allData);
              const getPeriodCalls = () => {
                if (statsPeriod === "alltime") return Object.values(data?.callLogs || {}).flat();
                const keys = statsPeriod === "week" ? getDateRangeKeys("week", today) : getDateRangeKeys("month", today);
                return (keys || []).flatMap(d => data?.callLogs?.[d] || []);
              };
              const periodCalls = getPeriodCalls();
              const periodClosed = periodCalls.filter(c => c.result === "Closed");
              const periodRevenue = periodClosed.reduce((s, c) => s + (Number(c.value_eur) || 0), 0);
              const periodAvgDeal = periodClosed.length > 0 ? Math.round(periodRevenue / periodClosed.length) : 0;
              const periodCloseRate = periodCalls.length > 0 ? Math.round(periodClosed.length / periodCalls.length * 100) : 0;
              const getDMKeys = () => {
                if (statsPeriod === "alltime") return Object.keys(data?.days || {});
                return getDateRangeKeys("week", today) ? [] : [];
              };
              const periodDMs = funnel.dmsSent;
              const revPerDMp = periodDMs > 0 ? (periodRevenue / periodDMs).toFixed(1) : "0";
              // Day ratings trend
              const ratingDays = Object.entries(dailyReviews || {}).filter(([d]) => {
                if (statsPeriod === "week") return getDateRangeKeys("week", today)?.includes(d);
                if (statsPeriod === "month") return d.startsWith(today.slice(0,7));
                return true;
              }).sort(([a],[b]) => a.localeCompare(b));
              const avgRating = ratingDays.length > 0 ? (ratingDays.reduce((s,[,r]) => s + r.rating, 0) / ratingDays.length).toFixed(1) : null;
              // Completion rate
              const periodDayKeys = getDMKeys();
              const completedDays = periodDayKeys.filter(d => data?.days?.[d]?._done).length;
              const completionRate = periodDayKeys.length > 0 ? Math.round(completedDays / periodDayKeys.length * 100) : 0;
              return (
                <>
                  {/* Period toggle */}
                  <div style={{ display:"flex", gap:4, marginBottom:16, background:"rgba(255,255,255,0.03)", borderRadius:10, padding:3 }}>
                    {perfPeriods.map(([v,l]) => (
                      <button key={v} onClick={() => setStatsPeriod(v)} style={{ flex:1, padding:"6px 0", borderRadius:8, border:"none", background:statsPeriod===v?"rgba(255,255,255,0.08)":"transparent", color:statsPeriod===v?"#fff":"rgba(255,255,255,0.3)", fontSize:10, fontWeight:700, cursor:"pointer" }}>{l}</button>
                    ))}
                  </div>

                  {/* Revenue */}
                  <div style={{ ...S.chartCard, marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>Revenue</div>
                    <div style={{ fontSize:32, fontWeight:800, color: periodRevenue>0?"#4ADE80":"#fff", marginBottom:4 }}>€{periodRevenue.toLocaleString()}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:12 }}>
                      {[["Deals",periodClosed.length],["Avg",periodAvgDeal>0?`€${periodAvgDeal.toLocaleString()}`:"—"],["Close rate",`${periodCloseRate}%`]].map(([l,v]) => (
                        <div key={l} style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:3 }}>{l}</div>
                          <div style={{ fontSize:14, fontWeight:700 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pipeline funnel */}
                  <div style={{ ...S.chartCard, marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>Pipeline</div>
                    {[["DMs Sent", periodDMs, 1],["Calls", periodCalls.length, periodDMs > 0 ? periodCalls.length/periodDMs : 0],["Closed", periodClosed.length, periodCalls.length > 0 ? periodClosed.length/periodCalls.length : 0],].map(([label, count, rate], i) => (
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", width:90, flexShrink:0 }}>{label}</div>
                        <div style={{ flex:1, height:6, background:"rgba(255,255,255,0.04)", borderRadius:3 }}>
                          <div style={{ height:"100%", width:`${Math.min(rate,1)*100}%`, background:["#60A5FA","#A78BFA","#4ADE80"][i], borderRadius:3 }}/>
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, width:36, textAlign:"right" }}>{count}</div>
                      </div>
                    ))}
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:4 }}>€{revPerDMp} per DM</div>
                  </div>

                  {/* Consistency */}
                  <div style={{ ...S.chartCard }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>Consistency</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      {[["Streak",`${data?.streak||0} days`],["Days done",`${completedDays}/${periodDayKeys.length}`],["Completion",`${completionRate}%`],["Avg rating",avgRating?`${avgRating}/5`:"—"]].map(([l,v]) => (
                        <div key={l} style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginBottom:3 }}>{l}</div>
                          <div style={{ fontSize:14, fontWeight:700 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Rating trend dots */}
                    {ratingDays.length > 0 && (
                      <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:32 }}>
                        {ratingDays.slice(-14).map(([d,r],i) => (
                          <div key={d} title={`${d}: ${r.rating}/5`} style={{ flex:1, height:`${r.rating/5*100}%`, minHeight:4, borderRadius:2, background:`rgba(255,215,0,${0.3+r.rating*0.14})` }}/>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sales Funnel */}
                  <div style={{ ...S.chartCard, marginTop:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>Sales Funnel</div>
                    {[
                      ["DMs Sent", funnel.dmsSent, null],
                      ["Calls Booked", funnel.callsBooked, funnel.dmToCallPct > 0 ? `${funnel.dmToCallPct}%` : null],
                      ["Show-up Rate", null, `${funnel.showUpRate}%`],
                      ["Calls Taken", funnel.callsTaken, null],
                      ["Close Rate", null, `${funnel.closeRate}%`],
                      ["Revenue", null, `€${funnel.revenue.toLocaleString()}`],
                      ["Rev/DM", null, funnel.revenuePerDm > 0 ? `€${funnel.revenuePerDm.toFixed(2)}` : "—"],
                      ["DM→Call", null, `${funnel.dmToCallPct}%`],
                      ["DM→Close", null, `${funnel.dmToClosePct}%`],
                      ["Avg Deal", null, funnel.avgDealValue > 0 ? `€${funnel.avgDealValue.toLocaleString()}` : "—"],
                      ["Time to Close", null, funnel.avgTimeToClose != null ? `${funnel.avgTimeToClose}d` : "—"],
                    ].map(([label, count, rate]) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{label}</span>
                        <span style={{ fontSize:13, fontWeight:700, color: label==="Revenue"?"#4ADE80":"#fff" }}>
                          {count != null ? count : ""}{rate != null ? (count != null ? ` (${rate})` : rate) : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Revenue Goal */}
                  <div style={{ ...S.chartCard, marginTop:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:12 }}>Monthly Revenue Goal</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:24, fontWeight:800, color:"#4ADE80" }}>€{funnel.revenue.toLocaleString()}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>of goal: {editingGoal ? (
                          <input type="number" autoFocus defaultValue={revenueGoal}
                            onBlur={e => { const v = Number(e.target.value); setRevenueGoal(v); setEditingGoal(false); saveMonthlyRevenueGoal(v).catch(console.error); }}
                            onKeyDown={e => { if (e.key==="Enter") { const v = Number(e.target.value); setRevenueGoal(v); setEditingGoal(false); saveMonthlyRevenueGoal(v).catch(console.error); } }}
                            style={{ width:80, background:"transparent", border:"none", borderBottom:"1px solid rgba(255,255,255,0.3)", color:"rgba(255,255,255,0.6)", fontSize:11, outline:"none" }} />
                        ) : (
                          <span style={{ cursor:"pointer", textDecoration:"underline" }} onClick={() => setEditingGoal(true)}>€{revenueGoal.toLocaleString()}</span>
                        )}</div>
                      </div>
                    </div>
                    {revenueGoal > 0 && (
                      <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3 }}>
                        <div style={{ height:"100%", width:`${Math.min(funnel.revenue/revenueGoal, 1)*100}%`, background:"#4ADE80", borderRadius:3, transition:"width 0.4s" }}/>
                      </div>
                    )}
                    {revenueGoal > 0 && <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:6 }}>{Math.round(funnel.revenue/revenueGoal*100)}% of goal</div>}
                  </div>

                  {/* Task streaks */}
                  <div style={{ ...S.sectionLabel, marginTop:16 }}>Task Streaks</div>
                  {DEFAULT_TASKS.map(t => {
                    const streak = taskStreaks[t.id] || 0;
                    const done = (td[t.id]||0) >= t.target;
                    return (
                      <div key={t.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:600 }}>{t.icon} {t.label}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          <span style={{ fontSize:12, fontWeight:700, color: streak>0?"#F59E0B":"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", gap:3 }}>
                            {I.fire}{streak > 0 ? streak : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Export Data button */}
                  <button onClick={() => {
                    console.log("=== DENIZ HQ DATA EXPORT ===");
                    console.log("All localStorage:", JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))));
                    console.log("Sales Funnel (All Time):", JSON.stringify(getSalesFunnel("all", { days: data?.days||{}, callLogs: data?.callLogs||{}, workLogs })));
                    console.log("Productivity (All Time):", JSON.stringify(getProductivityBreakdown("all", { days: data?.days||{}, callLogs: data?.callLogs||{}, workLogs })));
                    alert("Data exported to browser console (F12)");
                  }} style={{ ...S.logCallBtn, marginTop:16, color:"rgba(255,255,255,0.2)" }}>
                    Export Data (console)
                  </button>
                </>
              );
            })()}

            {/* ── Call History (always shown at bottom of performance) ── */}
            {statsView === "performance" && (() => {
              const allCallEntries = Object.entries(data?.callLogs || {})
                .filter(([, calls]) => calls.length > 0)
                .sort(([a], [b]) => b.localeCompare(a));
              if (allCallEntries.length === 0) return null;
              return (
                <>
                  <div style={S.sectionLabel}>Call History</div>
                  {allCallEntries.slice(0, 5).map(([date, calls]) => (
                    <div key={date} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                        {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      {calls.map((c, i) => (
                        <div key={i} style={{ ...S.callLogRow, paddingLeft: 0, cursor: "pointer" }} onClick={() => setCallModal({ _isEdit: true, _date: date, _index: i, ...c })}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: c.result==="Closed"?"#4ADE80":c.result==="Not Closed"?"#EF4444":"rgba(255,255,255,0.7)" }}>
                              {c.result}{c.value_eur > 0 && ` — €${Number(c.value_eur).toLocaleString()}`}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{c.time}</span>
                              <span style={{ color: "rgba(255,255,255,0.3)", padding: 2 }}>{I.pencil}</span>
                            </div>
                          </div>
                          {c.notes && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{c.notes}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              );
            })()}

          </>
        )}

        <div style={{ height: 100 }}/>
      </div>

      {/* FLOATING "WHAT SHOULD I DO?" BUTTON */}
      <button onClick={() => setWhatModal(true)} style={S.fab} title="What should I do?">
        {I.lightning}
      </button>

      {/* FAB + button */}
      <button onClick={() => setFabModal(true)} style={{
        position:"fixed", bottom: 72, right: 16, zIndex: 150,
        width: 48, height: 48, borderRadius: 24,
        background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff", fontSize: 24, cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
      }}>+</button>

      {/* Duration toast */}
      {durationToast && (
        <div style={{ position:"fixed", bottom: 72, left: 16, right: 72, zIndex: 200,
          background:"rgba(30,30,40,0.97)", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1, fontSize:13, fontWeight:600 }}>Nice! How long was {durationToast.label}?</div>
          <div style={{ display:"flex", gap:6 }}>
            {[15,30,60].map(m => (
              <button key={m} style={{ padding:"5px 10px", borderRadius:6, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}
                onClick={() => { logTaskDuration(durationToast.taskId, m); setDurationToast(null); }}>
                {m}m
              </button>
            ))}
            <button style={{ padding:"5px 10px", borderRadius:6, background:"transparent", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)", fontSize:11, cursor:"pointer" }}
              onClick={() => setDurationToast(null)}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={S.nav}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...S.navBtn, ...(tab===t.id?S.navActive:{}) }}>
            {tab===t.id && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:20, height:2, borderRadius:1, background:"#fff" }} />}
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.5, marginTop:2 }}>{t.label.toUpperCase()}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily:"'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif", background:"radial-gradient(ellipse 100% 30% at 50% 0%, rgba(0,200,220,0.06) 0%, transparent 100%), #0A0A0F", color:"#F0F0F5", minHeight:"100vh", maxWidth:480, margin:"0 auto", position:"relative" },

  header:       { position:"sticky", top:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px 14px", background:"rgba(10,10,15,0.92)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.06)", boxShadow:"0 1px 0 rgba(255,255,255,0.03)" },
  logo:         { height:24, objectFit:"contain" },
  headerLeft:   { display:"flex", alignItems:"center", gap:10 },
  headerDivider:{ width:1, height:24, background:"rgba(255,255,255,0.15)" },
  headerTitle:  { fontSize:15, fontWeight:700, color:"#fff", letterSpacing:0.5 },
  headerRight:  { display:"flex", alignItems:"center", gap:12 },
  streakBadge:  { display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:20, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", fontSize:13, fontWeight:800, color:"#fff" },
  avatar:       { width:32, height:32, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(255,255,255,0.1)" },

  content: { padding:"16px 16px 0", paddingBottom:90 },

  nav:       { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, display:"flex", background:"rgba(10,10,15,0.95)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,0.06)", zIndex:100, padding:"8px 0 calc(8px + env(safe-area-inset-bottom))" },
  navBtn:    { flex:1, background:"none", border:"none", color:"rgba(255,255,255,0.3)", fontSize:9, fontWeight:700, letterSpacing:0.5, cursor:"pointer", padding:"6px 0 2px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, position:"relative", textTransform:"uppercase" },
  navActive: { color:"#fff" },

  fab: { position:"fixed", bottom:80, right:"calc(50% - 240px + 16px)", width:48, height:48, borderRadius:24, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff", zIndex:99, boxShadow:"0 4px 20px rgba(0,0,0,0.4)" },

  modalBackdrop: { position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
  modalBox:      { background:"#161620", borderRadius:16, padding:24, width:"100%", maxWidth:380, border:"1px solid rgba(255,255,255,0.06)" },

  briefingBackdrop: { position:"fixed", inset:0, background:"#0A0A0F", zIndex:300, display:"flex", flexDirection:"column" },
  briefingInner:    { flex:1, display:"flex", flexDirection:"column", padding:"60px 32px 40px", maxWidth:480, margin:"0 auto", width:"100%" },

  welcome:   { marginBottom:24, paddingTop:4 },
  welcomeL1: { fontSize:22, fontWeight:800, color:"#fff", marginBottom:6 },
  welcomeL2: { fontSize:14, color:"rgba(255,255,255,0.5)", marginBottom:4 },
  welcomeL3: { fontSize:13, color:"rgba(255,255,255,0.35)" },

  progressSection: { display:"flex", alignItems:"center", gap:20, marginBottom:24 },
  sectionLabel:    { fontSize:10, fontWeight:800, letterSpacing:2, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", marginBottom:12, marginTop:4, display:"flex", alignItems:"center", gap:8 },

  schedRow:    { display:"flex", alignItems:"center", gap:10, padding:"11px 12px", marginBottom:4, borderRadius:10, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.04)", transition:"background 0.15s ease" },
  schedNow:    { background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", boxShadow:"0 0 0 1px rgba(255,255,255,0.04)" },
  schedDone:   { borderLeftColor:"#4ADE80", background:"rgba(74,222,128,0.04)" },
  schedMissed: { borderLeftColor:"rgba(239,68,68,0.5)", background:"rgba(239,68,68,0.03)" },
  schedTime:   { fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.3)", minWidth:44, display:"flex", flexDirection:"column", gap:3 },
  nowPill:     { fontSize:8, fontWeight:800, letterSpacing:1.5, color:"#fff", background:"rgba(255,255,255,0.15)", padding:"2px 5px", borderRadius:3 },
  missedPill:  { fontSize:8, fontWeight:800, letterSpacing:1, color:"rgba(239,68,68,0.7)", background:"rgba(239,68,68,0.1)", padding:"2px 5px", borderRadius:3 },
  schedName:   { fontSize:13, fontWeight:600, flex:1 },
  schedDur:    { fontSize:11, color:"rgba(255,255,255,0.25)" },

  taskRow:     { display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", position:"relative", overflow:"hidden" },
  taskRowDone: { opacity:0.5 },
  taskLeft:    { display:"flex", alignItems:"center", gap:12 },
  taskIcon:    { color:"rgba(255,255,255,0.4)" },
  taskName:    { fontSize:14, fontWeight:600 },
  taskSub:     { fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:1 },
  taskCheck:   { color:"#4ADE80" },
  taskBtns:    { display:"flex", gap:6 },
  qBtn:        { padding:"6px 12px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"rgba(255,255,255,0.6)", fontSize:11, fontWeight:600, cursor:"pointer" },
  qBtnDone:    { padding:"6px 10px", background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.15)", borderRadius:6, color:"#4ADE80", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center" },
  startBtn:    { padding:"6px 16px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", letterSpacing:0.5 },
  taskBar:     { width:"100%", height:2, background:"rgba(255,255,255,0.04)", borderRadius:1, marginTop:6 },
  taskBarFill: { height:"100%", borderRadius:1, transition:"width 0.4s ease" },

  focusPlayBtn: { display:"inline-flex", alignItems:"center", padding:"10px 24px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" },
  focusYes:     { padding:"10px 20px", background:"rgba(74,222,128,0.12)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:10, color:"#4ADE80", fontSize:13, fontWeight:700, cursor:"pointer" },
  focusNo:      { padding:"10px 20px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, color:"#EF4444", fontSize:13, fontWeight:600, cursor:"pointer" },
  focusDone:    { padding:"10px 20px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"rgba(255,255,255,0.5)", fontSize:13, fontWeight:600, cursor:"pointer" },

  logCallBtn:   { display:"flex", alignItems:"center", justifyContent:"center", width:"100%", padding:12, marginTop:16, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, color:"rgba(255,255,255,0.5)", fontSize:13, fontWeight:600, cursor:"pointer" },
  callLogRow:   { padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.03)" },
  testNotifBtn: { display:"flex", alignItems:"center", justifyContent:"center", width:"100%", padding:10, marginTop:12, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, color:"rgba(255,255,255,0.2)", fontSize:11, fontWeight:600, letterSpacing:0.5, cursor:"pointer" },

  checkRow:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" },
  checkDone:    { opacity:0.45 },
  checkLeft:    { display:"flex", alignItems:"center", gap:12 },
  checkBox:     { width:24, height:24, borderRadius:6, border:"2px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:12, fontWeight:800 },
  checkBoxDone: { background:"#4ADE80", borderColor:"#4ADE80", color:"#0A0A0F" },
  checkLabel:   { fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 },
  checkTarget:  { fontSize:11, color:"rgba(255,255,255,0.25)" },
  checkInput:   { width:56, padding:"6px 8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, color:"#fff", fontSize:16, fontWeight:700, textAlign:"right", outline:"none" },

  card:      { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:"18px 16px", marginBottom:12 },
  chartCard: { background:"rgba(255,255,255,0.02)", borderRadius:12, padding:14, marginBottom:8, border:"1px solid rgba(255,255,255,0.04)" },
  chartHead: { display:"flex", justifyContent:"space-between", fontSize:12, fontWeight:600, marginBottom:10 },
  miniChart: { display:"flex", gap:3, height:40, alignItems:"flex-end" },
  barCol:    { flex:1, height:"100%", display:"flex", alignItems:"flex-end" },
  bar:       { width:"100%", minHeight:2, borderRadius:2, transition:"height 0.4s", opacity:0.7 },

  iconBtn:     { background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"rgba(255,255,255,0.5)", cursor:"pointer", padding:"4px 6px", display:"flex", alignItems:"center" },
  editBtn:     { display:"flex", alignItems:"center", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"rgba(255,255,255,0.5)", fontSize:11, fontWeight:600, cursor:"pointer", padding:"4px 10px", gap:4 },
  editInput:   { padding:"6px 8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"#fff", fontSize:12, outline:"none" },
  addBlockBtn: { display:"flex", alignItems:"center", justifyContent:"center", width:"100%", padding:"10px", background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:8, color:"rgba(255,255,255,0.4)", fontSize:12, fontWeight:600, cursor:"pointer" },
  saveBtn:     { flex:1, padding:"10px", background:"rgba(0,200,220,0.12)", border:"1px solid rgba(0,200,220,0.2)", borderRadius:8, color:"rgba(0,220,240,0.9)", fontSize:13, fontWeight:700, cursor:"pointer" },
  cancelBtn:   { padding:"10px 16px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" },
};
