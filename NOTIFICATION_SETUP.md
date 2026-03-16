# Notification & Integration Setup

## Current Status
- **In-app notifications**: Working. Fire every 30 min while app is open.
- **Background notifications (SW)**: Working while Chrome/browser tab is open in background.
- **Push when fully closed**: Requires Firebase Cloud Messaging + server (see below).
- **Google Calendar sync**: Requires completing OAuth setup (see below).

---

## 1. Firebase Cloud Messaging (Server-Push Notifications)

### Prerequisites
- Firebase project: `funnels-notis` (already configured)
- VAPID key: already in `src/lib/notifications.js`

### Step 1: Create a Supabase Edge Function

In your Supabase dashboard → Edge Functions → New Function → name it `send-push`:

```typescript
// supabase/functions/send-push/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = "funnels-notis";
const FIREBASE_SERVER_KEY = "YOUR_FIREBASE_SERVER_KEY"; // from Firebase Console > Project Settings > Cloud Messaging

serve(async (req) => {
  const { deviceId, title, body } = await req.json();

  // Get FCM token for device
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await supabase
    .from("fcm_tokens")
    .select("token")
    .eq("device_id", deviceId)
    .single();

  if (!data?.token) return new Response("No token", { status: 404 });

  // Send via FCM
  const fcmRes = await fetch(`https://fcm.googleapis.com/fcm/send`, {
    method: "POST",
    headers: {
      "Authorization": `key=${FIREBASE_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: data.token,
      notification: { title, body },
    }),
  });

  const result = await fcmRes.json();
  return new Response(JSON.stringify(result), { status: 200 });
});
```

### Step 2: Get Firebase Server Key
1. Go to [Firebase Console](https://console.firebase.google.com) → `funnels-notis`
2. Project Settings → Cloud Messaging → Server Key
3. Replace `YOUR_FIREBASE_SERVER_KEY` above

### Step 3: Set up a scheduled job (optional)
Use Supabase's pg_cron or an external cron service to call your edge function every 30 minutes with a push notification.

### Step 4: Deploy
```bash
supabase functions deploy send-push
```

---

## 2. Google Calendar Integration

### Current Setup
- API Key: `AIzaSyDcxtvFzo53RrubwNK-JKXxlQZDvSGwLFY`
- Client ID: `1095657897784-s2rm09nasc6goi2l43rck6uh02o94uih.apps.googleusercontent.com`

### Step 1: Configure OAuth Consent Screen
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project linked to the API key above
3. APIs & Services → OAuth consent screen
4. Set app name: "Deniz HQ", add your email as a test user
5. Add scope: `https://www.googleapis.com/auth/calendar.readonly`

### Step 2: Add Authorized JavaScript Origins
In Credentials → OAuth 2.0 Client IDs → your client → Authorized JavaScript origins:
- `http://localhost:5173` (dev)
- `https://your-production-domain.com` (production)

### Step 3: Enable Calendar API
APIs & Services → Enable APIs → Google Calendar API → Enable

### Step 4: Test
Tap "Connect Google Calendar" in the Calendar tab. You should see an OAuth popup, then your events appear in the schedule.

---

## 3. Supabase Tables Required

Run these SQL commands in Supabase SQL Editor if tables don't exist:

```sql
-- daily_tasks (already exists, no changes needed)
-- call_logs (already exists)
-- work_logs — add category column if missing
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS category text DEFAULT '';

-- daily_reviews (already exists)
-- custom_schedules (already exists)
-- streak_data (already exists)
-- user_settings (already exists)
-- fcm_tokens (already exists)
```

---

## 4. Notification Icon
The notification icon file is: `public/NEW Notification icon.png`
- Must be a monochrome (white on transparent) PNG
- Used for both `icon` and `badge` in all notifications
