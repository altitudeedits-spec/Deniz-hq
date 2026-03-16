# FounderOS PWA

## Setup

### 1. Supabase — create tables

Open **Supabase → SQL Editor** and paste the contents of `supabase/schema.sql`, then click Run.

### 2. PWA icons (required for install prompt)

The manifest references `/icons/icon-192.png` and `/icons/icon-512.png`.
Generate them from the included SVG:

```bash
# Using sharp-cli (npm i -g sharp-cli)
sharp -i public/icons/icon.svg -o public/icons/icon-192.png resize 192 192
sharp -i public/icons/icon.svg -o public/icons/icon-512.png resize 512 512
```

Or drag `public/icons/icon.svg` into https://realfavicongenerator.net and download the package.

### 3. Firebase — enable Cloud Messaging

1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Confirm Web Push certificates — VAPID key is already wired in.
3. To send **scheduled server-side notifications**, create a Supabase Edge Function
   that reads from `fcm_tokens` and calls the FCM HTTP v1 API at your chosen schedule.
   The `fcm_tokens` table is populated automatically when users grant permission.

### 4. Install & run

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

### 5. Deploy

Upload `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, etc.).
The service worker requires HTTPS to activate — all of those hosts provide it automatically.

---

## How notifications work

| Scenario | Delivery |
|---|---|
| App tab is open | `onMessage` fires → browser `Notification` API |
| Tab is closed, browser running | `firebase-messaging-sw.js` background handler |
| Browser fully closed | Requires server push (FCM HTTP v1 API) |

Client-side `scheduleLocalNotifications()` sets `setTimeout` for today's remaining
schedule items while the tab is open (07:00 workout, 08:00 outreach, 15:00 sales,
18:00 CEO work, 21:00 end-of-day).
