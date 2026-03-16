import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gfuaeastkwmcxhdhevmx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Msn2tFYYvnZ2MeRWIab5uA_1XcvqCj4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function getDeviceId() {
  let id = localStorage.getItem("founderos_device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("founderos_device_id", id); }
  return id;
}

// ─── Full-state localStorage persistence ──────────────────────────────────────
const LS_KEY = "deniz-hq-data";
export function readLocalState() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function writeLocalState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────
export async function loadData() {
  const deviceId = getDeviceId();
  const local = readLocalState();
  const baseline = {
    days:           local?.data?.days           ?? {},
    callLogs:       local?.data?.callLogs       ?? {},
    workLogs:       local?.data?.workLogs       ?? {},
    dailyReviews:   local?.data?.dailyReviews   ?? {},
    ceoLogs:        {},
    streak:         local?.data?.streak         ?? 0,
    rank:           local?.data?.rank           ?? 0,
    revenue:        local?.revenue              ?? 0,
    customSchedules:local?.customSchedules      ?? {},
  };

  console.log("[Deniz HQ] Device:", deviceId, "| Baseline days:", Object.keys(baseline.days).length);

  try {
    const [tasksRes, callsRes, streakRes, schedRes, settingsRes, workRes, reviewRes] = await Promise.all([
      supabase.from("daily_tasks").select("*").eq("device_id", deviceId),
      supabase.from("call_logs").select("*").eq("device_id", deviceId),
      supabase.from("streak_data").select("*").eq("device_id", deviceId).maybeSingle(),
      supabase.from("custom_schedules").select("*").eq("device_id", deviceId),
      supabase.from("user_settings").select("*").eq("device_id", deviceId).maybeSingle(),
      supabase.from("work_logs").select("*").eq("device_id", deviceId),
      supabase.from("daily_reviews").select("*").eq("device_id", deviceId),
    ]);

    [tasksRes,callsRes,streakRes,schedRes,settingsRes,workRes,reviewRes].forEach((r,i)=>{
      if(r.error) console.warn(`[Deniz HQ] table[${i}] error:`, r.error.message);
    });

    // daily_tasks
    let days = baseline.days;
    if (tasksRes.data?.length > 0) {
      days = {};
      for (const row of tasksRes.data) {
        if (!days[row.date]) days[row.date] = {};
        if (row.task_id === "_done") { if (row.value === 1) days[row.date]._done = true; }
        else days[row.date][row.task_id] = row.value;
      }
    }

    // call_logs
    let callLogs = baseline.callLogs;
    if (callsRes.data?.length > 0) {
      callLogs = {};
      for (const row of callsRes.data) {
        if (!callLogs[row.date]) callLogs[row.date] = [];
        callLogs[row.date].push({ result: row.result, notes: row.notes, time: row.time, value_eur: row.value_eur ?? 0, call_type: row.call_type || "sales", gcal_event_id: row.gcal_event_id || null, linked_call_id: row.linked_call_id || null, duration_minutes: row.duration_minutes || 0, event_date: row.event_date || row.date, id: row.id });
      }
    }

    // work_logs
    let workLogs = baseline.workLogs;
    if (workRes.data?.length > 0) {
      workLogs = {};
      for (const row of workRes.data) {
        if (!workLogs[row.date]) workLogs[row.date] = [];
        workLogs[row.date].push({ taskId: row.task_id, minutes: row.minutes, description: row.description, timestamp: row.timestamp, category: row.category ?? "" });
      }
    }

    // daily_reviews
    let dailyReviews = baseline.dailyReviews;
    if (reviewRes.data?.length > 0) {
      dailyReviews = {};
      for (const row of reviewRes.data) {
        dailyReviews[row.date] = { rating: row.rating, priorityTomorrow: row.priority_tomorrow };
      }
    }

    // custom_schedules
    let customSchedules = baseline.customSchedules;
    if (schedRes.data?.length > 0) {
      customSchedules = {};
      for (const row of schedRes.data) {
        try { customSchedules[row.date] = JSON.parse(row.schedule_json); } catch {}
      }
    }

    const sd = streakRes.data;
    const st = settingsRes.data;

    const result = {
      days, callLogs, workLogs, dailyReviews, ceoLogs: {},
      streak:  sd ? (sd.streak ?? 0) : baseline.streak,
      rank:    sd ? (sd.rank   ?? 0) : baseline.rank,
      revenue: st ? (st.monthly_revenue ?? 0) : baseline.revenue,
      revenueGoal: st ? (st.monthly_revenue_goal ?? 0) : (Number(localStorage.getItem("deniz_revenue_goal")) || 0),
      customSchedules,
    };
    console.log("[Deniz HQ] Supabase sync OK — days:", Object.keys(result.days).length);
    return result;
  } catch (err) {
    console.error("[Deniz HQ] Supabase failed, using local cache:", err.message);
    return baseline;
  }
}

// ─── SAVE TASK VALUE ──────────────────────────────────────────────────────────
export async function saveTaskValue(date, taskId, value) {
  const deviceId = getDeviceId();
  try {
    const { error } = await supabase.from("daily_tasks").upsert(
      { device_id: deviceId, date, task_id: taskId, value, updated_at: new Date().toISOString() },
      { onConflict: "device_id,date,task_id" }
    );
    if (error) console.warn("[Deniz HQ] saveTaskValue:", error.message);
  } catch (e) { console.warn("[Deniz HQ] saveTaskValue exception:", e.message); }
}
export async function saveDayDone(date, done) { await saveTaskValue(date, "_done", done ? 1 : 0); }

// ─── STREAK ───────────────────────────────────────────────────────────────────
export async function saveStreak(streak, rank) {
  const deviceId = getDeviceId();
  try {
    const { error } = await supabase.from("streak_data").upsert(
      { device_id: deviceId, streak, rank, updated_at: new Date().toISOString() },
      { onConflict: "device_id" }
    );
    if (error) console.warn("[Deniz HQ] saveStreak:", error.message);
  } catch (e) { console.warn("[Deniz HQ] saveStreak exception:", e.message); }
}

// ─── CALL LOGS ────────────────────────────────────────────────────────────────
export async function logCallToSupabase(date, callData) {
  const deviceId = getDeviceId();
  try {
    const { error } = await supabase.from("call_logs").insert({
      device_id: deviceId, date,
      result: callData.result || "",
      notes: callData.notes ?? "",
      time: callData.time || new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),
      value_eur: callData.value_eur ?? 0,
      call_type: callData.call_type || "sales",
      gcal_event_id: callData.gcal_event_id || null,
      linked_call_id: callData.linked_call_id || null,
      duration_minutes: callData.duration_minutes || 0,
      event_date: callData.event_date || date,
    });
    if (error) console.warn("[Deniz HQ] logCall:", error.message);
  } catch (e) { console.warn("[Deniz HQ] logCall exception:", e.message); }
}

// ─── WORK LOGS ────────────────────────────────────────────────────────────────
export async function saveWorkLog(date, taskId, minutes, description, category = "") {
  const deviceId = getDeviceId();
  try {
    const { error } = await supabase.from("work_logs").insert({
      device_id: deviceId, date, task_id: taskId, minutes,
      description: description ?? "", timestamp: new Date().toISOString(),
      category: category ?? "",
    });
    if (error) console.warn("[Deniz HQ] saveWorkLog:", error.message);
  } catch (e) { console.warn("[Deniz HQ] saveWorkLog exception:", e.message); }
}

// ─── TASK DURATION (for count tasks that reach target) ─────────────────────────
// Stored as a special task_id "dur_<taskId>" so no schema change needed
export async function saveTaskDuration(date, taskId, durationMinutes) {
  return saveTaskValue(date, "dur_" + taskId, durationMinutes);
}

// ─── DAILY REVIEWS ────────────────────────────────────────────────────────────
export async function saveDailyReview(date, rating, priorityTomorrow) {
  const deviceId = getDeviceId();
  try {
    const { error } = await supabase.from("daily_reviews").upsert(
      { device_id: deviceId, date, rating, priority_tomorrow: priorityTomorrow, reviewed_at: new Date().toISOString() },
      { onConflict: "device_id,date" }
    );
    if (error) console.warn("[Deniz HQ] saveDailyReview:", error.message);
  } catch (e) { console.warn("[Deniz HQ] saveDailyReview exception:", e.message); }
}

// ─── CUSTOM SCHEDULES ─────────────────────────────────────────────────────────
export async function saveCustomSchedule(date, scheduleArr) {
  const deviceId = getDeviceId();
  try {
    const { error } = await supabase.from("custom_schedules").upsert(
      { device_id: deviceId, date, schedule_json: JSON.stringify(scheduleArr), updated_at: new Date().toISOString() },
      { onConflict: "device_id,date" }
    );
    if (error) console.warn("[Deniz HQ] saveCustomSchedule:", error.message);
  } catch (e) { console.warn("[Deniz HQ] saveCustomSchedule exception:", e.message); }
}

// ─── UPDATE CALL LOGS FOR DATE (delete + re-insert) ───────────────────────────
export async function updateCallLogsForDate(date, calls) {
  const deviceId = getDeviceId();
  try {
    await supabase.from("call_logs").delete().eq("device_id", deviceId).eq("date", date);
    for (const c of calls) {
      await supabase.from("call_logs").insert({
        device_id: deviceId, date,
        result: c.result, notes: c.notes ?? "", time: c.time, value_eur: c.value_eur ?? 0,
      });
    }
  } catch (e) { console.warn("[Deniz HQ] updateCallLogs exception:", e.message); }
}

// ─── MONTHLY REVENUE GOAL ─────────────────────────────────────────────────────
export async function saveMonthlyRevenueGoal(goal) {
  const deviceId = getDeviceId();
  localStorage.setItem("deniz_revenue_goal", String(goal));
  try {
    const { error } = await supabase.from("user_settings").upsert(
      { device_id: deviceId, monthly_revenue_goal: goal, updated_at: new Date().toISOString() },
      { onConflict: "device_id" }
    );
    if (error) console.warn("[Deniz HQ] saveRevenueGoal:", error.message);
  } catch (e) { console.warn("[Deniz HQ] saveRevenueGoal exception:", e.message); }
}

// ─── DELETE CUSTOM SCHEDULE ───────────────────────────────────────────────────
export async function deleteCustomSchedule(date) {
  const deviceId = getDeviceId();
  try {
    await supabase.from("custom_schedules").delete().eq("device_id", deviceId).eq("date", date);
  } catch (e) { console.warn("[Deniz HQ] deleteCustomSchedule:", e.message); }
}

// ─── REVENUE / SETTINGS ───────────────────────────────────────────────────────
export async function saveRevenue(amount) {
  const deviceId = getDeviceId();
  localStorage.setItem("deniz_revenue", amount);
  try {
    const { error } = await supabase.from("user_settings").upsert(
      { device_id: deviceId, monthly_revenue: amount, updated_at: new Date().toISOString() },
      { onConflict: "device_id" }
    );
    if (error) console.warn("[Deniz HQ] saveRevenue:", error.message);
  } catch (e) { console.warn("[Deniz HQ] saveRevenue exception:", e.message); }
}
