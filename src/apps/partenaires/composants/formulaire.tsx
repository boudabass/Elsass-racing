"use client"

// Briques des formulaires de Partenaires : un formulaire qui appelle une Server Action (useActionState), son bouton,
// et un champ avec son libellé. Le message de succès ou de refus s'affiche sous les champs.

import { useActionState, useEffect, type ReactNode } from "react"
import { useFormStatus } from "react-dom"

import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, BOUTON_DANGER, BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

export type ActionFormulaire = (etat: Resultat | null, donnees: FormData) => Promise<Resultat>

export function FormulaireAction({
  action,
  children,
  ok,
  className = "flex flex-col gap-4",
  auSucces,
  nom,
}: {
  action: ActionFormulaire
  children: ReactNode
  ok?: string
  className?: string
  auSucces?: (resultat: Extract<Resultat, { ok: true }>) => void
  nom: string
}) {
  const [resultat, envoyer] = useActionState(action, null)

  // Une seule fois par envoi : la réponse réussie est passée à auSucces (par exemple pour ouvrir la fiche créée).
  useEffect(() => {
    if (resultat?.ok && auSucces) auSucces(resultat)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auSucces suit le rendu du parent, pas la réponse.
  }, [resultat])

  return (
    <form action={envoyer} className={className} aria-label={nom}>
      {children}
      <Message resultat={resultat} ok={ok} />
    </form>
  )
}

// Bouton d'envoi : désactivé pendant l'envoi du formulaire parent.
// Trois rôles (brief 3.10, §3) : principal (défaut), secondaire (une action sur la fiche), danger (supprimer, résilier).
export function BoutonEnvoi({ libelle, secondaire = false, danger = false, className }: { libelle: string; secondaire?: boolean; danger?: boolean; className?: string }) {
  const { pending } = useFormStatus()
  const style = danger ? BOUTON_DANGER : secondaire ? BOUTON_SECONDAIRE : BOUTON
  return (
    <button type="submit" disabled={pending} className={className ?? style}>
      {pending ? "Envoi…" : libelle}
    </button>
  )
}

// Champ avec son libellé visible. L'aide, s'il y en a une, est reliée au champ.
export function Champ({ id, libelle, aide, children }: { id: string; libelle: string; aide?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {libelle}
      </label>
      {children}
      {aide && (
        <p id={`${id}-aide`} className="text-sm text-texte-discret">
          {aide}
        </p>
      )}
    </div>
  )
}
