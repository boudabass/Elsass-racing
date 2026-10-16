"use client"

import { useEffect } from "react"

import { nettoyerBasesDeconnectees } from "@/core/synchro/client/base"

// Page de connexion : aucune session ici, donc les bases locales des comptes déconnectés sont
// retirées de l'appareil. Une base qui a encore des modifications en attente est gardée.
export function NettoyageLocal() {
  useEffect(() => {
    void nettoyerBasesDeconnectees().catch(() => undefined)
  }, [])
  return null
}
