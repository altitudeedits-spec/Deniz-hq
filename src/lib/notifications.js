import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase, getDeviceId } from "./supabase.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDcxtvFzo53RrubwNK-JKXxlQZDvSGwLFY",
  authDomain: "funnels-notis.firebaseapp.com",
  projectId: "funnels-notis",
  storageBucket: "funnels-notis.firebasestorage.app",
  messagingSenderId: "1095657897784",
  appId: "1:1095657897784:web:523ccc89a5c7bbb0990bcd",
};

const VAPID_KEY =
  "BDq-fznnnN1BUgAhSTzQ7LIk9lqXb7pueAc8NRYfV6cBrzXJBHblSfYmlsWuOHLNd_WoktlKkiUQDtH7Du6BxDQ";

export const BADGE_URL = "/NEW Notification icon.png";
export const ICON_URL  = "/NEW Notification icon.png";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(val, target) { return target > 0 ? (val || 0) / target : 1; }

function urgencyLine(label, val, target, unit) {
  const rem = target - (val || 0);
  if (unit === "min") return `${val || 0}/${target} min logged for ${label}. ${rem} min to go.`;
  return `${val || 0}/${target} ${unit || "reps"} for ${label}. ${rem} more needed.`;
}

// Pick one of several variants pseudo-randomly based on minute of day
function pick(arr) {
  const idx = Math.floor(Date.now() / 60000) % arr.length;
  return arr[idx];
}

// ── Core payload builder ──────────────────────────────────────────────────────
// todayTasks: array of { id, label, target, unit } from getTodaysTasks()
// revenueGoal: number (€)
export function getNotificationPayload(schedule, taskData, priority = null, todayTasks = [], revenueGoal = 0) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const td = taskData || {};

  // Only tracked tasks (those with a matching schedule block)
  const trackedTasks = todayTasks.filter(t => {
    // must have a block in today's schedule
    return schedule.some(s => {
      const sid = s.taskId || s.blockId ||
        (s.label && ("block_" + s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")));
      return sid === t.id;
    });
  });

  const goalStr = revenueGoal > 0 ? ` Your €${revenueGoal.toLocaleString()} goal doesn't care about excuses.` : "";

  // ── TYPE 0: EOD wind-down after 22:00 ────────────────────────────────────
  if (nowMin >= 22 * 60) {
    const doneTasks = trackedTasks.filter(t => (td[t.id] || 0) >= t.target);
    if (doneTasks.length === trackedTasks.length && trackedTasks.length > 0) {
      return { title: "Day locked in 🔒", body: `All ${trackedTasks.length} tasks completed. That's what winners look like. Rest, recover, repeat.` };
    }
    const missed = trackedTasks.filter(t => (td[t.id] || 0) < t.target);
    const missedLabels = missed.map(t => t.label).join(", ");
    return { title: "Day review time", body: `Still open: ${missedLabels}. Log your day and set tomorrow's priority.` };
  }

  // ── TYPE 1: Priority check around 14:00 ──────────────────────────────────
  if (priority && nowMin >= 13 * 60 + 30 && nowMin <= 14 * 60 + 30) {
    return {
      title: "Mid-day priority check",
      body: `You set "${priority}" as today's priority. Have you made real progress on it? Be honest.`,
    };
  }

  // ── TYPE 2: Task starting very soon (≤15 min) — highest urgency ──────────
  for (const s of schedule) {
    const startMin = parseInt(s.time) * 60;
    const diff = startMin - nowMin;
    if (diff > 0 && diff <= 15) {
      // Find corresponding task for label
      const tid = s.taskId || s.blockId;
      const task = trackedTasks.find(t => t.id === tid);
      const label = task?.label || s.label;
      return {
        title: `${label} in ${diff} min`,
        body: pick([
          `Close everything else. This block is non-negotiable.${goalStr}`,
          `No warm-up. You start the moment the clock hits. Get ready.`,
          `Everything else waits. ${label} is next — prepare now.`,
        ]),
      };
    }
  }

  // ── TYPE 3: Task starting in 16–30 min — prep reminder ───────────────────
  for (const s of schedule) {
    const startMin = parseInt(s.time) * 60;
    const diff = startMin - nowMin;
    if (diff > 15 && diff <= 30) {
      const tid = s.taskId || s.blockId;
      const task = trackedTasks.find(t => t.id === tid);
      const label = task?.label || s.label;
      return {
        title: `${label} in ${diff} min`,
        body: `Wrap up what you're doing. This block starts in ${diff} minutes — no late starts.`,
      };
    }
  }

  // ── TYPE 4: Currently in a block but task not done ────────────────────────
  for (const s of schedule) {
    const startMin = parseInt(s.time) * 60;
    const endMin   = startMin + (s.dur || 60);
    if (nowMin >= startMin && nowMin < endMin) {
      const tid = s.taskId || s.blockId;
      const task = trackedTasks.find(t => t.id === tid);
      if (!task) continue;
      const val = td[task.id] || 0;
      if (val >= task.target) continue; // already done
      const minLeft = endMin - nowMin;
      return {
        title: `${task.label} — block ending in ${minLeft} min`,
        body: urgencyLine(task.label, val, task.target, task.unit) + ` ${minLeft} min left in this block.${goalStr}`,
      };
    }
  }

  // ── TYPE 5: Missed blocks (block ended, task incomplete) ─────────────────
  const missed = [];
  for (const s of schedule) {
    const startMin = parseInt(s.time) * 60;
    const endMin   = startMin + (s.dur || 60);
    if (nowMin < endMin) continue; // block hasn't ended
    const tid = s.taskId || s.blockId;
    const task = trackedTasks.find(t => t.id === tid);
    if (!task) continue;
    const val = td[task.id] || 0;
    if (val >= task.target) continue; // done
    missed.push({ task, val, endMin });
  }
  if (missed.length > 0) {
    // Most critical = latest block that ended (most recent miss)
    missed.sort((a, b) => b.endMin - a.endMin);
    const { task, val } = missed[0];
    return {
      title: "Missed block",
      body: pick([
        `${task.label}: ${val}/${task.target} ${task.unit || ""}. That window is gone. When are you making it up?${goalStr}`,
        `You skipped ${task.label}. That's a choice. Is it the one you want to make?`,
        `${task.label} block is over and you're at ${val}/${task.target}. The work doesn't disappear — it stacks.`,
      ]),
    };
  }

  // ── TYPE 6: Behind on tasks not yet started ───────────────────────────────
  const behind = trackedTasks
    .filter(t => {
      const val = td[t.id] || 0;
      return val < t.target && val > 0;
    })
    .map(t => ({ task: t, val: td[t.id] || 0, completion: pct(td[t.id] || 0, t.target) }))
    .sort((a, b) => a.completion - b.completion);

  if (behind.length > 0) {
    const { task, val } = behind[0];
    return {
      title: "Stay on track",
      body: urgencyLine(task.label, val, task.target, task.unit) + pick([
        ` You're in it, keep going.`,
        ` Don't stop now — momentum is everything.${goalStr}`,
        ` Push through. Incomplete is worse than never starting.`,
      ]),
    };
  }

  // ── TYPE 7: All done — reinforce ─────────────────────────────────────────
  if (trackedTasks.length > 0) {
    const allDone = trackedTasks.every(t => (td[t.id] || 0) >= t.target);
    if (allDone) {
      return {
        title: "All tasks complete",
        body: pick([
          "Every target hit. That's who you're becoming. Stay locked in until end of day.",
          `Full completion. Most people won't do this today. You did.${goalStr}`,
          "Done. Now protect the rest of the day — no distractions, no backsliding.",
        ]),
      };
    }
  }

  // ── TYPE 8: Time-based fallback (nothing specific) ────────────────────────
  const timeMessages = [
    [6 * 60,  8 * 60,  "Morning. DMs and outreach first. Start strong."],
    [8 * 60,  10 * 60, "Deep work window. Phone face down. No context switches."],
    [10 * 60, 12 * 60, "What have you shipped this morning? Be specific."],
    [12 * 60, 13 * 60, "Midday. Execution, not planning. What's left today?"],
    [13 * 60, 15 * 60, `Afternoon block.${goalStr} Keep moving.`],
    [15 * 60, 17 * 60, "Final deep work window. Make it count."],
    [17 * 60, 19 * 60, "Push hour. What absolutely must be done before you rest?"],
    [19 * 60, 21 * 60, "Evening. Log your work, prepare tomorrow. Nothing wasted."],
    [21 * 60, 22 * 60, "Last hour. Review the day. Did you give everything?"],
  ];
  for (const [start, end, msg] of timeMessages) {
    if (nowMin >= start && nowMin < end) return { title: "Deniz HQ", body: msg };
  }

  return { title: "Deniz HQ", body: "Stay disciplined. Every hour is a choice." };
}

// Schedule 30-min interval notifications via the service worker
export async function scheduleAggressiveNotifications(schedule, taskData, priority = null) {
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const endMin = 22 * 60; // stop at 22:00

  // Build list of upcoming :00 and :30 slots
  const notifications = [];
  for (let slotMin = Math.ceil(nowMin / 30) * 30; slotMin <= endMin; slotMin += 30) {
    const delayMs = (slotMin - nowMin) * 60 * 1000;
    if (delayMs <= 0) continue;
    const payload = getNotificationPayload(schedule, taskData, priority);
    notifications.push({ delayMs, title: payload.title, body: payload.body });
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "SCHEDULE_NOTIFS", notifications, badge: BADGE_URL, icon: ICON_URL });
  } catch (err) {
    console.warn("Could not send notifications to SW:", err);
  }
}

let _messaging = null;

export async function initNotifications() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const firebaseApp = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
    _messaging = getMessaging(firebaseApp);

    const swReg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/firebase-cloud-messaging-push-scope" }
    );

    const token = await getToken(_messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

    if (token) {
      try {
        const deviceId = getDeviceId();
        await supabase.from("fcm_tokens").delete().eq("device_id", deviceId);
        await supabase.from("fcm_tokens").insert({ device_id: deviceId, token, updated_at: new Date().toISOString() });
      } catch { /* non-critical */ }
    }

    onMessage(_messaging, (payload) => {
      const { title = "Deniz HQ", body = "" } = payload.notification ?? {};
      if (Notification.permission === "granted") {
        new Notification(title, { body, badge: BADGE_URL, icon: ICON_URL });
      }
    });

    return token;
  } catch (err) {
    console.warn("FCM setup failed:", err);
    return null;
  }
}
