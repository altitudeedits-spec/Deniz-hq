// Deniz HQ Service Worker
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.hostname.endsWith("supabase.co"),
  new NetworkFirst({ cacheName: "supabase-api", networkTimeoutSeconds: 5 })
);
registerRoute(
  ({ url }) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts" })
);
registerRoute(
  ({ request }) => request.destination === "image" || request.destination === "style",
  new CacheFirst({ cacheName: "assets" })
);

const BADGE = "/NEW Notification icon.png";
const ICON  = "/NEW Notification icon.png";

function notifOptions(body, icon, badge) {
  return {
    body,
    badge: badge || BADGE,
    icon:  icon  || ICON,
    vibrate: [200, 100, 200],
    tag: "deniz-hq",
    renotify: true,
    requireInteraction: true,
    data: { url: "/" },
  };
}

// Store pending notifications in IndexedDB so they survive SW restarts
const PENDING_STORE = "pending-notifications";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("deniz-hq-sw", 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(PENDING_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

async function savePendingNotifs(notifications, badge, icon) {
  const db = await openDb();
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const store = tx.objectStore(PENDING_STORE);
  // Clear old ones
  store.clear();
  for (const n of notifications) {
    store.add({ ...n, badge, icon, scheduledAt: Date.now() });
  }
  return new Promise(r => { tx.oncomplete = r; });
}

async function checkAndFirePendingNotifs() {
  const db = await openDb();
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const store = tx.objectStore(PENDING_STORE);
  const all = await new Promise(r => { const req = store.getAll(); req.onsuccess = e => r(e.target.result); });
  const now = Date.now();
  const toDelete = [];
  for (const n of all) {
    const fireAt = n.scheduledAt + n.delayMs;
    if (now >= fireAt) {
      await self.registration.showNotification(n.title, {
        body: n.body,
        badge: n.badge || BADGE,
        icon: n.icon || ICON,
        vibrate: [200, 100, 200],
        tag: "deniz-hq",
        renotify: true,
        requireInteraction: true,
        data: { url: "/" },
      });
      toDelete.push(n.id);
    }
  }
  if (toDelete.length > 0) {
    const tx2 = db.transaction(PENDING_STORE, "readwrite");
    const s2 = tx2.objectStore(PENDING_STORE);
    for (const id of toDelete) s2.delete(id);
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SCHEDULE_NOTIFS") return;
  const { notifications = [], badge, icon } = event.data;
  event.waitUntil(savePendingNotifs(notifications, badge, icon));
});

// Check pending notifications on every fetch (keeps SW alive)
self.addEventListener("fetch", (event) => {
  // Don't interfere with fetches, just piggyback
  checkAndFirePendingNotifs().catch(() => {});
});

// ─── Push event (server push) ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { return; }
  const title = payload.notification?.title ?? "Deniz HQ";
  event.waitUntil(self.registration.showNotification(title, notifOptions(payload.notification?.body ?? "", ICON, BADGE)));
});

// ─── Notification click → open / focus app ───────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return clients.openWindow(event.notification.data?.url ?? "/");
    })
  );
});
