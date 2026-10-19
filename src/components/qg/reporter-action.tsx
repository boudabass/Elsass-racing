"use client"

import { useState } from "react"

import { Tiroir } from "@/components/formulaire/tiroir"
import { reporterAction } from "@/core/actions/formulaires"
import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

const BOUTON_DISCRET =
  "cible-tactile inline-flex items-center rounded-md border border-bordure px-4 py-2 text-sm font-medium text-texte-discret hover:bg-surface-2"

const CHOIX = [
  { jours: 1, libelle: "Demain" },
  { jours: 3, libelle: "Dans 3 jours" },
  { jours: 7, libelle: "Dans 7 jours" },
]

// « Plus tard » : un tiroir de choix pour repousser l'action (brief 3.13b). Chaque choix est un envoi au serveur.
export function ReporterAction({ actionId, titre }: { actionId: string; titre: string }) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOuvert(true)} className={BOUTON_DISCRET}>
        Plus tard
      </button>
      <Tiroir ouvert={ouvert} onOuvertChange={setOuvert} titre="Plus tard" sousTitre={titre} libelleAnnuler="Fermer">
        <div className="flex flex-col gap-2">
          {CHOIX.map((choix) => (
            <form key={choix.jours} action={reporterAction}>
              <input type="hidden" name="actionId" value={actionId} />
              <input type="hidden" name="jours" value={choix.jours} />
              <button type="submit" className={`${BOUTON_SECONDAIRE} w-full`}>
                {choix.libelle}
              </button>
            </form>
          ))}
        </div>
      </Tiroir>
    </>
  )
}
