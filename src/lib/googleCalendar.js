// Google Calendar — GIS token-only (no gapi, no API key, no discovery doc)

export const GOOGLE_CONFIG = {
  clientId: "1095657897784-s2rm09nasc6goi2l43rck6uh02o94uih.apps.googleusercontent.com",
  scopes:   "https://www.googleapis.com/auth/calendar.readonly",
};

const TOKEN_KEY        = "gcal_token";
const EXPIRY_KEY       = "gcal_token_expiry";
const EVENTS_CACHE_KEY = "gcal_events_cache";

let _gisReady    = false;
let _tokenClient = null;
let _accessToken = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureGis() {
  if (_gisReady) return;
  console.log("[GCal] Loading GIS script...");
  await loadScript("https://accounts.google.com/gsi/client");
  _gisReady = true;
  console.log("[GCal] GIS ready");
}

// ── Token storage helpers ──────────────────────────────────────────────────────

function saveToken(token, expiresIn) {
  _accessToken = token;
  localStorage.setItem(TOKEN_KEY,  token);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + (expiresIn || 3600) * 1000));
}

function clearToken() {
  _accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(EVENTS_CACHE_KEY);
}

/** Called on app load — returns stored token if still valid, null otherwise */
export function getStoredGcalToken() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = Number(localStorage.getItem(EXPIRY_KEY) || 0);
  if (token && expiry && Date.now() < expiry) return token;
  clearToken();
  return null;
}

/** Restore a previously-fetched token into the module (e.g. after page reload) */
export function restoreGcalToken(token) {
  _accessToken = token;
}

export function getCachedGcalEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function connectGoogleCalendar() {
  console.log("[GCal] connectGoogleCalendar() called");
  console.log("[GCal] Client ID:", GOOGLE_CONFIG.clientId);
  console.log("[GCal] Origin:", window.location.origin);

  await ensureGis();

  return new Promise((resolve, reject) => {
    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.clientId,
      scope:     GOOGLE_CONFIG.scopes,
      callback:  (response) => {
        console.log("[GCal] OAuth callback:", response);
        if (response.error) {
          const msg = `${response.error}: ${response.error_description || ""}`.trim();
          console.error("[GCal] OAuth error:", msg);
          reject(new Error(msg));
          return;
        }
        saveToken(response.access_token, response.expires_in);
        console.log("[GCal] Token saved. Expires in", response.expires_in, "s");
        resolve(response.access_token);
      },
      error_callback: (err) => {
        console.error("[GCal] error_callback:", err);
        reject(new Error(err?.message || "OAuth popup failed or was blocked"));
      },
    });

    console.log("[GCal] Requesting access token...");
    _tokenClient.requestAccessToken({ prompt: "" });
  });
}

export async function disconnectGoogleCalendar() {
  if (_accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(_accessToken, () => console.log("[GCal] Token revoked"));
  }
  clearToken();
}

export function isGoogleCalendarConnected() {
  return Boolean(_accessToken);
}

// ── isCallEvent helper ─────────────────────────────────────────────────────────

function isCallEvent(ev) {
  const text = ((ev.summary || "") + " " + (ev.description || "") + " " + (ev.location || "")).toLowerCase();
  return ["call","calendly","zoom","meet","sales","discovery"].some(k => text.includes(k));
}

// ── Calendar API via direct fetch() ───────────────────────────────────────────

export async function fetchCalendarEvents(timeMin, timeMax) {
  if (!_accessToken) { console.warn("[GCal] Not connected"); return []; }
  try {
    // Get all calendars
    const calListRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${_accessToken}` }
    });
    const calListData = await calListRes.json();
    const calendars = calListData.items || [];
    console.log("[GCal] Found", calendars.length, "calendars:", calendars.map(c => c.summary));

    const allItems = [];
    for (const cal of calendars) {
      const params = new URLSearchParams({ timeMin, timeMax, singleEvents:"true", orderBy:"startTime", maxResults:"250" });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
        { headers: { Authorization: `Bearer ${_accessToken}` } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      console.log(`[GCal] "${cal.summary}": ${(data.items||[]).length} events`);
      for (const ev of (data.items || [])) {
        allItems.push({ ...ev, _calendarId: cal.id, _calendarName: cal.summary });
      }
    }

    const mapped = allItems.map(ev => ({
      id: ev.id,
      title: ev.summary || "Calendar Event",
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      description: ev.description || "",
      location: ev.location || "",
      isCallEvent: isCallEvent(ev),
      calendarId: ev._calendarId,
      calendarName: ev._calendarName,
    }));

    // Store keyed by date
    const byDate = {};
    for (const ev of mapped) {
      if (!ev.start) continue;
      const dateStr = ev.start.split("T")[0];
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push(ev);
    }
    localStorage.setItem("gcal_events_all", JSON.stringify(byDate));
    localStorage.setItem("gcal_events_cache_date", new Date().toISOString().split("T")[0]);
    // Legacy cache for compatibility
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(mapped));
    console.log("[GCal] Stored events for", Object.keys(byDate).length, "days");
    return mapped;
  } catch(e) {
    console.error("[GCal] fetchCalendarEvents error:", e);
    return [];
  }
}

export function getGcalEventsForDate(dateStr) {
  try {
    const all = JSON.parse(localStorage.getItem("gcal_events_all") || "{}");
    return all[dateStr] || [];
  } catch { return []; }
}

export function getAllGcalEventsByDate() {
  try { return JSON.parse(localStorage.getItem("gcal_events_all") || "{}"); }
  catch { return {}; }
}

export function saveGcalEventClassification(eventId, classification) {
  try {
    const all = JSON.parse(localStorage.getItem("gcal_classifications") || "{}");
    all[eventId] = classification;
    localStorage.setItem("gcal_classifications", JSON.stringify(all));
  } catch {}
}

export function getGcalEventClassification(eventId) {
  try {
    const all = JSON.parse(localStorage.getItem("gcal_classifications") || "{}");
    return all[eventId] || "sales";
  } catch { return "sales"; }
}

export function eventToScheduleBlock(ev) {
  const start = new Date(ev.start);
  const end   = new Date(ev.end);
  return {
    time:        `${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`,
    label:       ev.title,
    dur:         Math.round((end - start) / 60000) || 60,
    gcalId:      ev.id,
    isCallEvent: ev.isCallEvent,
    source:      "google",
    taskType:    ev.isCallEvent ? "call" : "display",
    startMs:     start.getTime(),
    endMs:       end.getTime(),
  };
}
