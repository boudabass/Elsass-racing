"use client"

import { useEffect } from "react"

// Pages clés, mises en cache dès qu'on est en ligne : elles existent hors ligne même si on ne les a
// jamais ouvertes. Les apps synchronisées viendront s'ajouter ici.
const PAGES_CLES = ["/qg", "/notes"]

// Enregistre le service worker (/sw.js) et lui demande de précharger les pages clés. En production
// seulement : en développement, le cache gênerait les rechargements du serveur de dev.
export function EnregistrementSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (navigator.onLine && registration.active) {
          registration.active.postMessage({ type: "precharger", urls: PAGES_CLES })
        }
      })
      .catch(() => undefined)
  }, [])
  return null
}
