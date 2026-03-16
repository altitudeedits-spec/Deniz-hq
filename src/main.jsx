import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Register service worker — required for PWA installability on Android
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available — could show a "Refresh" prompt here
            }
          });
        });
      })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
