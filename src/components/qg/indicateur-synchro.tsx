"use client"

import { useState } from "react"

import { useEtatSynchro } from "@/core/synchro/client/react"

// Indicateur discret de la barre haute : « Hors ligne », « 3 modifications en attente », ou
// « Synchronisé il y a 2 min ». Sur téléphone, une simple pastille : le détail s'affiche au toucher.
// Un conflit n'apparaît pas ici : il est dans le journal de la fiche.
export function IndicateurSynchro() {
  const etat = useEtatSynchro()
  const [detail, setDetail] = useState(false)

  let libelle = "En ligne"
  let couleur = "text-etat-ok"
  // Les modifications en attente passent avant l'état du réseau : c'est ce que la personne doit savoir.
  if (etat.enAttente > 0) {
    libelle = `${etat.enAttente} ${etat.enAttente > 1 ? "modifications" : "modification"} en attente`
    couleur = etat.enLigne ? "text-texte-discret" : "text-etat-orange"
  } else if (!etat.enLigne) {
    libelle = "Hors ligne"
    couleur = "text-etat-orange"
  } else if (etat.derniereSync) {
    libelle = `Synchronisé ${depuis(etat.derniereSync)}`
    couleur = "text-texte-discret"
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setDetail((ouvert) => !ouvert)}
        aria-label={libelle}
        aria-expanded={detail}
        className={`cible-tactile flex items-center justify-center px-1 sm:hidden ${couleur}`}
      >
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-current" />
      </button>
      {detail && (
        <span role="status" className="absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-md border border-bordure bg-surface px-2 py-1 text-xs text-texte shadow-lg sm:hidden">
          {libelle}
        </span>
      )}
      <span role="status" aria-live="polite" className={`hidden max-w-[10rem] items-center gap-1.5 truncate text-xs sm:flex ${couleur}`}>
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-current" />
        <span className="truncate">{libelle}</span>
      </span>
    </span>
  )
}

function depuis(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  return `il y a ${minutes} min`
}
