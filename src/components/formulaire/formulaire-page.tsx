"use client"

// Formulaire de création sur une page entière (brief 3.13b, décision 1). La page reste une page, mais elle finit comme un
// tiroir : une barre fixe en bas, « Annuler » à gauche, le verbe précis à droite. Quitter une saisie modifiée demande
// « Abandonner les modifications ? » dans l'app, jamais une boîte du navigateur.

import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"

import { BOUTON, BOUTON_DANGER, BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

interface Options {
  // Id du <form> rendu dans children : le bouton principal de la barre le soumet par cet attribut.
  formulaireId: string
  annulerHref: string
  libelleBouton: string
  libelleEnCours?: string
  enCours?: boolean
  desactive?: boolean
  children: ReactNode
}

export function FormulairePage({ formulaireId, annulerHref, libelleBouton, libelleEnCours, enCours = false, desactive = false, children }: Options) {
  const router = useRouter()
  const [modifie, setModifie] = useState(false)
  const [demandeAbandon, setDemandeAbandon] = useState(false)

  function annuler() {
    if (modifie) return setDemandeAbandon(true)
    router.push(annulerHref)
  }

  return (
    <div className="flex flex-col gap-6" onChange={() => setModifie(true)}>
      {children}
      <div className="sticky bottom-0 -mx-4 border-t border-bordure bg-surface p-4 sm:-mx-0 sm:rounded-md sm:border">
        {demandeAbandon ? (
          <div className="flex flex-col gap-3">
            <p className="font-medium">Abandonner les modifications ?</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => router.push(annulerHref)} className={BOUTON_DANGER}>
                Abandonner
              </button>
              <button type="button" onClick={() => setDemandeAbandon(false)} className={BOUTON}>
                Continuer la saisie
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={annuler} className={BOUTON_SECONDAIRE}>
              Annuler
            </button>
            <button type="submit" form={formulaireId} disabled={enCours || desactive} className={BOUTON}>
              {enCours ? (libelleEnCours ?? "Envoi…") : libelleBouton}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
