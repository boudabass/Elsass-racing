"use client"

// Les actions d'une preuve (brief 3.13, règle 5 et 6) : Masquer ou Afficher est un bouton en un clic, sans saisie.
// Supprimer ouvre un tiroir de confirmation, qui dit ce qui va se passer.

import { useActionState } from "react"

import { Message } from "@/components/formulaire/message"
import { TiroirAction } from "@/components/formulaire/tiroir"

import { BoutonEnvoi, type ActionFormulaire } from "./formulaire"

export function ActionsPreuve({
  preuveId,
  visiblePartenaire,
  masquer,
  supprimer,
}: {
  preuveId: string
  visiblePartenaire: boolean
  masquer: ActionFormulaire
  supprimer: ActionFormulaire
}) {
  const [etatMasquer, envoyerMasquer] = useActionState(masquer, null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={envoyerMasquer} aria-label="Visibilité de la preuve">
          <input type="hidden" name="proofId" value={preuveId} />
          <input type="hidden" name="visible" value={visiblePartenaire ? "non" : "oui"} />
          <BoutonEnvoi libelle={visiblePartenaire ? "Masquer" : "Afficher"} secondaire />
        </form>
        <TiroirAction
          libelle="Supprimer"
          titre="Supprimer la preuve"
          action={supprimer}
          libelleBouton="Supprimer la preuve"
          libelleEnCours="Suppression…"
          danger
          question="Supprimer cette preuve ? Elle disparaît de la contrepartie, pour la team comme pour le partenaire."
        >
          <input type="hidden" name="proofId" value={preuveId} />
        </TiroirAction>
      </div>
      <Message resultat={etatMasquer} />
    </div>
  )
}
