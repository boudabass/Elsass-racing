"use client"

import { useEffect } from "react"

// Enregistre le service worker (/sw.js). En production seulement : en développement, le cache
// gênerait les rechargements du serveur de dev.
export function EnregistrementSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }, [])
  return null
}
