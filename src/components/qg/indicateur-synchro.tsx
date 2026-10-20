"use client"

import { useState } from "react"
import { Check, CloudOff, Clock, type LucideIcon } from "lucide-react"

import { Tiroir } from "@/components/formulaire/tiroir"
import { useEtatSynchro } from "@/core/synchro/client/react"

// Indicateur discret de la barre haute : « Hors ligne », « 3 modifications en attente », ou
// « Synchronisé il y a 2 min ». Sur téléphone, une icône par état (la couleur n'est qu'un renfort) ;
// au toucher, un tiroir de lecture « État de la synchro » (brief 3.13b). Un conflit n'apparaît pas ici :
// il est dans le journal de la fiche.
export function IndicateurSynchro() {
  const etat = useEtatSynchro()
  const [ouvert, setOuvert] = useState(false)

  let libelle = "En ligne"
  let explication = "Tout ce que tu saisis part tout de suite."
  let couleur = "text-etat-ok"
  let Icone: LucideIcon = Check
  // Les modifications en attente passent avant l'état du réseau : c'est ce que la personne doit savoir.
  if (etat.enAttente > 0) {
    libelle = `${etat.enAttente} ${etat.enAttente > 1 ? "modifications" : "modification"} en attente`
    explication = "Elles sont gardées sur cet appareil et partent dès que la connexion le permet."
    couleur = etat.enLigne ? "text-texte-discret" : "text-etat-orange"
    Icone = Clock
  } else if (!etat.enLigne) {
    libelle = "Hors ligne"
    explication = "Ce que tu saisis est gardé sur cet appareil et part dès que la connexion revient."
    couleur = "text-etat-orange"
    Icone = CloudOff
  } else if (etat.derniereSync) {
    libelle = `Synchronisé ${depuis(etat.derniereSync)}`
    explication = "Tout ce que tu saisis part tout de suite."
    couleur = "text-texte-discret"
  }

  // Ce que lit un lecteur d'écran : l'état seul, sans la durée qui change à chaque minute.
  let etatAnnonce = libelle
  if (etat.enAttente === 0 && etat.enLigne && etat.derniereSync) etatAnnonce = "En ligne"

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={libelle}
        onClick={() => setOuvert(true)}
        className={`cible-tactile flex items-center justify-center gap-1.5 px-1 text-xs ${couleur}`}
      >
        <Icone aria-hidden className="h-5 w-5 sm:hidden" />
        <span aria-hidden className="hidden h-2 w-2 shrink-0 rounded-full bg-current sm:block" />
        <span aria-hidden className="hidden max-w-[10rem] truncate sm:block">
          {libelle}
        </span>
      </button>
      <span role="status" className="sr-only">
        {etatAnnonce}
      </span>

      <Tiroir ouvert={ouvert} onOuvertChange={setOuvert} titre="État de la synchro" libelleAnnuler="Fermer">
        <div className="flex flex-col gap-2">
          <p className={`text-lg font-medium ${couleur}`}>{libelle}</p>
          <p className="text-texte-discret">{explication}</p>
        </div>
      </Tiroir>
    </>
  )
}

function depuis(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  return `il y a ${minutes} min`
}
