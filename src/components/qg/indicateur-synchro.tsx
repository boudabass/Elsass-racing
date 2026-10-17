"use client"

import { useEffect, useRef, useState } from "react"
import { Check, CloudOff, Clock, type LucideIcon } from "lucide-react"

import { useEtatSynchro } from "@/core/synchro/client/react"

// Indicateur discret de la barre haute : « Hors ligne », « 3 modifications en attente », ou
// « Synchronisé il y a 2 min ». Sur téléphone, une icône par état (la couleur n'est qu'un renfort) ;
// le détail s'affiche au toucher et se ferme au toucher ailleurs. Un conflit n'apparaît pas ici :
// il est dans le journal de la fiche.
export function IndicateurSynchro() {
  const etat = useEtatSynchro()
  const [detail, setDetail] = useState(false)
  const racine = useRef<HTMLSpanElement>(null)

  let libelle = "En ligne"
  let couleur = "text-etat-ok"
  let Icone: LucideIcon = Check
  // Les modifications en attente passent avant l'état du réseau : c'est ce que la personne doit savoir.
  if (etat.enAttente > 0) {
    libelle = `${etat.enAttente} ${etat.enAttente > 1 ? "modifications" : "modification"} en attente`
    couleur = etat.enLigne ? "text-texte-discret" : "text-etat-orange"
    Icone = Clock
  } else if (!etat.enLigne) {
    libelle = "Hors ligne"
    couleur = "text-etat-orange"
    Icone = CloudOff
  } else if (etat.derniereSync) {
    libelle = `Synchronisé ${depuis(etat.derniereSync)}`
    couleur = "text-texte-discret"
  }

  // Ce que lit un lecteur d'écran : l'état seul, sans la durée qui change à chaque minute.
  let etatAnnonce = libelle
  if (etat.enAttente === 0 && etat.enLigne && etat.derniereSync) etatAnnonce = "En ligne"

  useEffect(() => {
    if (!detail) return
    const fermer = (evenement: PointerEvent) => {
      if (racine.current && !racine.current.contains(evenement.target as Node)) setDetail(false)
    }
    document.addEventListener("pointerdown", fermer)
    return () => document.removeEventListener("pointerdown", fermer)
  }, [detail])

  return (
    <span ref={racine} className="relative">
      <button
        type="button"
        onClick={() => setDetail((ouvert) => !ouvert)}
        aria-label={libelle}
        aria-expanded={detail}
        className={`cible-tactile flex items-center justify-center px-1 sm:hidden ${couleur}`}
      >
        <Icone aria-hidden className="h-5 w-5" />
      </button>
      {detail && (
        <span role="status" className="absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-md border border-bordure bg-surface px-2 py-1 text-xs text-texte shadow-lg sm:hidden">
          {libelle}
        </span>
      )}
      <span className={`hidden max-w-[10rem] items-center gap-1.5 truncate text-xs sm:flex ${couleur}`}>
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-current" />
        <span className="truncate">{libelle}</span>
      </span>
      <span role="status" className="sr-only">{etatAnnonce}</span>
    </span>
  )
}

function depuis(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  return `il y a ${minutes} min`
}
