"use client"

// Les actions d'une contrepartie (brief 3.10, §2) : une ligne de boutons, et un seul formulaire ouvert à la fois. Le
// formulaire ouvert s'affiche sous la ligne, sur toute sa largeur. « Ajouter une preuve » suit la liste des preuves et
// partage le même état : l'ouvrir referme les autres. Les formulaires fermés restent montés, pour garder ce qui est saisi.

import { useId, useState, type ReactNode } from "react"

import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

export interface ActionContrepartie {
  cle: string
  libelle: string
  contenu: ReactNode
}

export function ActionsContrepartie({
  actions,
  preuves,
  ajoutPreuve,
}: {
  actions: ActionContrepartie[]
  preuves: ReactNode
  ajoutPreuve: ActionContrepartie
}) {
  const [ouverte, setOuverte] = useState<string | null>(null)
  const identifiant = useId()

  const basculer = (cle: string) => setOuverte((courante) => (courante === cle ? null : cle))

  const bouton = (action: ActionContrepartie) => (
    <button
      key={action.cle}
      type="button"
      aria-expanded={ouverte === action.cle}
      aria-controls={`${identifiant}-${action.cle}`}
      onClick={() => basculer(action.cle)}
      className={`${BOUTON_SECONDAIRE} cursor-pointer`}
    >
      {action.libelle}
    </button>
  )

  const panneau = (action: ActionContrepartie) => (
    <div
      key={action.cle}
      id={`${identifiant}-${action.cle}`}
      role="region"
      aria-label={action.libelle}
      className={ouverte === action.cle ? "flex flex-col gap-3 rounded-md border border-bordure p-4" : "hidden"}
    >
      {action.contenu}
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">{actions.map(bouton)}</div>
        {actions.map(panneau)}
      </div>

      <div className="flex flex-col gap-3 border-t border-bordure pt-4">
        {preuves}
        <div className="flex flex-wrap items-center gap-3">{bouton(ajoutPreuve)}</div>
        {panneau(ajoutPreuve)}
      </div>
    </>
  )
}
