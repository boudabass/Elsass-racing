"use client"

// Les deux actions d'une preuve, Masquer ou Afficher et Supprimer (brief 3.7, point 0) : le message de résultat
// s'affiche sous la ligne, et non entre les deux boutons. Les deux formulaires partagent un seul message.

import { useActionState } from "react"

import { Message } from "@/components/formulaire/message"

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
  const [etatSupprimer, envoyerSupprimer] = useActionState(supprimer, null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={envoyerMasquer} aria-label="Visibilité de la preuve">
          <input type="hidden" name="proofId" value={preuveId} />
          <input type="hidden" name="visible" value={visiblePartenaire ? "non" : "oui"} />
          <BoutonEnvoi libelle={visiblePartenaire ? "Masquer" : "Afficher"} secondaire />
        </form>
        <form action={envoyerSupprimer} aria-label="Supprimer la preuve">
          <input type="hidden" name="proofId" value={preuveId} />
          <BoutonEnvoi libelle="Supprimer" danger />
        </form>
      </div>
      <Message resultat={etatMasquer ?? etatSupprimer} />
    </div>
  )
}
