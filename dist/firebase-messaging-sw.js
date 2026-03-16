// Firebase Cloud Messaging — background message handler
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDcxtvFzo53RrubwNK-JKXxlQZDvSGwLFY",
  authDomain: "funnels-notis.firebaseapp.com",
  projectId: "funnels-notis",
  storageBucket: "funnels-notis.firebasestorage.app",
  messagingSenderId: "1095657897784",
  appId: "1:1095657897784:web:523ccc89a5c7bbb0990bcd",
});

const messaging = firebase.messaging();
const BADGE = "/NEW Notification icon.png";
const ICON  = "/NEW Notification icon.png";

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Deniz HQ";
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? "",
    badge: BADGE,
    icon: ICON,
    vibrate: [200, 100, 200],
    tag: "deniz-hq",
    renotify: true,
    requireInteraction: true,
    data: { url: "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return clients.openWindow(event.notification.data?.url ?? "/");
    })
  );
});
