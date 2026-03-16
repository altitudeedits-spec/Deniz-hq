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

const SCHED_TASK_MAP = {
  "Morning Workout": "pushups", "Instagram Outreach": "ig_outreach",
  "Sales Calls": "sales_calls", "Client Delivery": "client_work",
  "CEO Strategy": "ceo_work", "Content Creation": "content",
  "Evening Workout": "situps", "Content Planning & Script": "content",
  "Finish Script": "content", "Record Content": "content", "Edit Content": "content",
};

// Returns the best notification payload given current context
export function getNotificationPayload(schedule, taskData, priority = null) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hour = now.getHours();

  const TARGETS = { ig_outreach:50, upwork:5, pushups:200, situps:200, client_work:120, ceo_work:120, content:60, sales_calls:2 };

  // Before 7am or after 22:00 — silence
  if (hour < 7 || hour >= 22) return null;

  // TYPE 0 — priority reminder at ~14:00
  if (priority && nowMin >= 13*60+30 && nowMin <= 14*60+30) {
    return { title: "Priority check", body: `You said: "${priority}". Have you started?` };
  }

  // TYPE 1 — task starting in next 15 min
  for (const s of schedule) {
    const startMin = parseInt(s.time)*60;
    const diff = startMin - nowMin;
    if (diff > 0 && diff <= 15) {
      return { title: `${s.label} in ${diff}min`, body: `Get ready. No distractions.` };
    }
  }

  // TYPE 2 — behind on count tasks (most important)
  const behind = [];
  for (const [tid, target] of Object.entries(TARGETS)) {
    const val = taskData[tid] || 0;
    const pct = val / target;
    if (pct < 1 && pct > 0) behind.push({ tid, val, target, pct });
    if (pct === 0) {
      // Check if this task's schedule block has passed
      const label = { ig_outreach:"Instagram Outreach", upwork:"Upwork Proposals", pushups:"Morning Workout", situps:"Evening Workout", client_work:"Client Delivery", ceo_work:"CEO Strategy", content:"Content Creation", sales_calls:"Sales Calls" }[tid];
      const block = schedule.find(s => s.label === label);
      if (block) {
        const blockEndMin = parseInt(block.time)*60 + block.dur;
        if (nowMin > blockEndMin) behind.push({ tid, val:0, target, pct:0, missed:true });
      }
    }
  }

  // Most critical: missed tasks
  const missed = behind.filter(b => b.missed);
  if (missed.length > 0) {
    const b = missed[0];
    const labels = { ig_outreach:"DMs", upwork:"Upwork proposals", pushups:"pushups", situps:"situps", client_work:"client work", ceo_work:"CEO work", content:"content", sales_calls:"sales calls" };
    return { title: "Missed block", body: `${labels[b.tid] || b.tid}: 0/${b.target}. That block is done. When will you make it up?` };
  }

  // In-progress tasks behind target
  if (behind.length > 0) {
    behind.sort((a,b) => a.pct - b.pct);
    const b = behind[0];
    const labels = { ig_outreach:"DMs", upwork:"Upwork proposals", pushups:"pushups", situps:"situps", client_work:"client work min", ceo_work:"CEO work min", content:"content min", sales_calls:"sales calls" };
    const rem = b.target - b.val;
    return { title: "Stay on track", body: `${labels[b.tid] || b.tid}: ${b.val}/${b.target}. ${rem} more to target.` };
  }

  // TYPE 3 — all tasks done or on track
  const allDone = Object.entries(TARGETS).every(([tid, target]) => (taskData[tid]||0) >= target);
  if (allDone) return { title: "Locked in", body: "All targets hit. Stay in the zone until end of day." };

  // TYPE 4 — fallback: time-specific accountability
  const timeMessages = [
    [7*60, 9*60, "Morning block. DMs and outreach first — no email, no social."],
    [9*60, 12*60, "Deep work hours. Phone face down. Execute."],
    [12*60, 13*60, "Midday check. What have you actually produced today?"],
    [13*60, 17*60, "Afternoon execution. Calls, client work. Keep moving."],
    [17*60, 19*60, "Final push. What's not done yet that must be done today?"],
    [19*60, 22*60, "Evening. Log what you did. Prepare tomorrow."],
  ];
  for (const [start, end, msg] of timeMessages) {
    if (nowMin >= start && nowMin < end) return { title: "Deniz HQ", body: msg };
  }

  return { title: "Deniz HQ", body: "Stay disciplined. Every hour counts." };
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
