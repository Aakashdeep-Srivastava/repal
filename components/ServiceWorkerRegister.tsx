"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) so RePal is installable on
 * mobile ("Add to Home Screen") and keeps working offline. Registration is
 * deferred to window `load` so it never competes with first paint. Failures are
 * swallowed — a missing/blocked SW must never break the app.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* no-op: app works without the SW, just not offline/installable */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

export default ServiceWorkerRegister;
