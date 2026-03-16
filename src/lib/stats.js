// src/lib/stats.js
// Single source of truth for all stat calculations

// dateRange: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } or null for all-time
// allData: { days, callLogs, workLogs }

export function getDateRangeKeys(rangeType) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  if (rangeType === "week") {
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { start: monday.toISOString().split("T")[0], end: sunday.toISOString().split("T")[0] };
  }
  if (rangeType === "month") {
    return { start: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, end: todayStr };
  }
  return { start: "2020-01-01", end: todayStr }; // all-time
}

function inRange(dateStr, range) {
  if (!range) return true;
  return dateStr >= range.start && dateStr <= range.end;
}

// Returns total productive minutes in date range
export function getTotalProductiveMinutes(rangeType, allData) {
  const range = getDateRangeKeys(rangeType);
  const { workLogs = {}, callLogs = {} } = allData;
  let total = 0;
  for (const [date, logs] of Object.entries(workLogs)) {
    if (!inRange(date, range)) continue;
    for (const l of (logs || [])) total += Number(l.minutes) || 0;
  }
  for (const [date, logs] of Object.entries(callLogs)) {
    if (!inRange(date, range)) continue;
    for (const l of (logs || [])) total += Number(l.duration_minutes) || 0;
  }
  return total;
}

// Returns { fitness, clientAcq, clientFul, offerRef, other } in minutes
export function getProductivityBreakdown(rangeType, allData) {
  const range = getDateRangeKeys(rangeType);
  const { workLogs = {}, callLogs = {} } = allData;
  const result = { fitness: 0, clientAcq: 0, clientFul: 0, offerRef: 0, other: 0 };

  const FITNESS_TASKS = new Set(["pushups","situps","morning_workout","evening_workout"]);
  const CLIENT_ACQ_TASKS = new Set(["ig_outreach","upwork","content","instagram_outreach","upwork_proposals"]);
  const CLIENT_FUL_TASKS = new Set(["client_work","client_delivery"]);
  const OFFER_REF_TASKS = new Set(["ceo_work","ceo_strategy"]);

  let timerMins = 0, callMins = 0;

  for (const [date, logs] of Object.entries(workLogs)) {
    if (!inRange(date, range)) continue;
    for (const l of (logs || [])) {
      const mins = l.minutes || 0;
      if (!mins) continue;
      timerMins += mins;
      const cat = l.category || "";
      const tid = (l.taskId || "").toLowerCase();
      if (cat === "Fitness" || FITNESS_TASKS.has(tid)) result.fitness += mins;
      else if (cat === "Client Acquisition" || CLIENT_ACQ_TASKS.has(tid)) result.clientAcq += mins;
      else if (cat === "Client Fulfilment" || CLIENT_FUL_TASKS.has(tid)) result.clientFul += mins;
      else if (cat === "Offer Refinement" || OFFER_REF_TASKS.has(tid)) result.offerRef += mins;
      else result.other += mins;
    }
  }

  for (const [date, logs] of Object.entries(callLogs)) {
    if (!inRange(date, range)) continue;
    for (const l of (logs || [])) {
      const mins = Number(l.duration_minutes) || 0;
      if (!mins) continue;
      callMins += mins;
      const type = (l.call_type || "sales").toLowerCase();
      if (type === "client") result.clientFul += mins;
      else result.clientAcq += mins;
    }
  }

  const total = result.fitness + result.clientAcq + result.clientFul + result.offerRef + result.other;
  console.log(`[Stats] Breakdown (${rangeType}): timer=${timerMins}m calls=${callMins}m total=${total}m`, result);
  return result;
}

// Returns full sales funnel metrics
export function getSalesFunnel(rangeType, allData) {
  const range = getDateRangeKeys(rangeType);
  const { days = {}, callLogs = {} } = allData;

  // DMs sent
  let dmsSent = 0;
  for (const [date, td] of Object.entries(days)) {
    if (!inRange(date, range)) continue;
    dmsSent += (td.ig_outreach || 0) + (td.upwork || 0);
  }

  // Build call list (exclude client calls)
  const allCalls = [];
  for (const [date, logs] of Object.entries(callLogs)) {
    if (!inRange(date, range)) continue;
    for (const l of logs) {
      if ((l.call_type || "sales") === "client") continue;
      allCalls.push({ ...l, date });
    }
  }

  // Deduplicate: rescheduled calls linked to original count as 1 opportunity
  const linkedIds = new Set(allCalls.filter(c => c.linked_call_id).map(c => String(c.linked_call_id)));
  const uniqueOpportunities = allCalls.filter(c => !linkedIds.has(String(c.id)));

  const now = Date.now();
  const callsBooked = uniqueOpportunities.length;
  const pastCalls = uniqueOpportunities.filter(c => {
    const eventDate = c.event_date || c.date;
    return new Date(eventDate).getTime() < now;
  });
  const noShows = pastCalls.filter(c => c.result === "No-show").length;
  const showUpRate = pastCalls.length > 0 ? Math.round(((pastCalls.length - noShows) / pastCalls.length) * 100) : 0;
  const callsTaken = pastCalls.filter(c => c.result && c.result !== "No-show").length;
  const closes = allCalls.filter(c => c.result === "Closed").length;
  const closeRate = callsTaken > 0 ? Math.round((closes / callsTaken) * 100) : 0;
  const revenue = allCalls.filter(c => c.result === "Closed").reduce((s, c) => s + (Number(c.value_eur) || 0), 0);
  const revenuePerDm = dmsSent > 0 ? revenue / dmsSent : 0;
  const dmToCallPct = dmsSent > 0 ? Math.round((callsBooked / dmsSent) * 100 * 10) / 10 : 0;
  const dmToClosePct = dmsSent > 0 ? Math.round((closes / dmsSent) * 100 * 10) / 10 : 0;
  const avgDealValue = closes > 0 ? Math.round(revenue / closes) : 0;

  // Time to close
  const closedWithDates = allCalls.filter(c => c.result === "Closed" && c.event_date);
  const avgTimeToClose = closedWithDates.length > 0
    ? Math.round(closedWithDates.reduce((s, c) => {
        const days = (new Date(c.date).getTime() - new Date(c.event_date).getTime()) / (1000*60*60*24);
        return s + Math.max(0, days);
      }, 0) / closedWithDates.length)
    : null;

  return { dmsSent, callsBooked, showUpRate, callsTaken, closeRate, revenue, revenuePerDm, dmToCallPct, dmToClosePct, avgDealValue, avgTimeToClose, closes, noShows };
}

export function getTaskStreaks(allData) {
  const { days = {} } = allData;
  const TASKS = [
    { id: "ig_outreach", target: 50 }, { id: "upwork", target: 5 },
    { id: "pushups", target: 200 }, { id: "situps", target: 200 },
    { id: "client_work", target: 120 }, { id: "ceo_work", target: 120 },
    { id: "content", target: 60 }, { id: "sales_calls", target: 2 },
  ];
  const result = {};
  for (const task of TASKS) {
    let streak = 0;
    const d = new Date(); d.setDate(d.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split("T")[0];
      if ((days[ds]?.[task.id] || 0) >= task.target) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    result[task.id] = streak;
  }
  return result;
}

export function getDayCompletion(date, allData, schedule) {
  const { days = {} } = allData;
  const td = days[date] || {};
  if (!schedule || schedule.length === 0) return { completed: 0, total: 0, percentage: 0 };
  const SCHED_TASK_MAP = {
    "Morning Workout":"pushups","Instagram Outreach":"ig_outreach",
    "Client Delivery":"client_work","CEO Strategy":"ceo_work",
    "Content Creation":"content","Evening Workout":"situps","Instagram DMs":"ig_outreach",
    "Content Planning & Script":"content","Finish Script":"content",
    "Record Content":"content","Edit Content":"content","Upwork Proposals":"upwork",
  };
  const seen = new Set();
  const tasks = [];
  for (const s of schedule) {
    const tid = s.taskId || SCHED_TASK_MAP[s.label];
    if (tid && !seen.has(tid)) { seen.add(tid); tasks.push(tid); }
  }
  const TARGETS = { ig_outreach:50, upwork:5, pushups:200, situps:200, client_work:120, ceo_work:120, content:60, sales_calls:2 };
  const total = tasks.length;
  const completed = tasks.filter(tid => (td[tid] || 0) >= (TARGETS[tid] || 1)).length;
  return { completed, total, percentage: total > 0 ? Math.round((completed/total)*100) : 0 };
}
