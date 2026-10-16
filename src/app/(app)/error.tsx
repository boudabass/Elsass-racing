"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { journaliserErreur } from "@/core/erreurs/client"

// Écran d'erreur de l'espace connecté : jamais le message technique brut. L'erreur part au journal.
export default function ErreurEspace({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const [horsLigne, setHorsLigne] = useState(false)

  useEffect(() => {
    void journaliserErreur(error)
    setHorsLigne(!navigator.onLine)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="titre-rallye text-3xl">Quelque chose s&apos;est mal passé.</h1>
      <p className="text-texte-discret">Réessaie. Si ça revient, préviens le responsable de la team.</p>
      {horsLigne && <p className="text-etat-orange">Tu es hors ligne : certaines pages ne sont pas disponibles sans réseau.</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cible-tactile rounded-md bg-marque px-5 py-2 font-medium text-white hover:opacity-90"
        >
          Recharger
        </button>
        <Link href="/qg" className="cible-tactile rounded-md border border-bordure px-5 py-2 hover:bg-surface-2">
          Retour au QG
        </Link>
      </div>
    </div>
  )
}
