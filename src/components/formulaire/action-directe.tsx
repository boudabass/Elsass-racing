"use client"

import { useActionState } from "react"

import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, BOUTON_DANGER, BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

// Une action sans saisie : un clic la fait (Monter, Renvoyer, Revoir les écrans…). Le message reste sous le bouton,
// et l'erreur dit pourquoi l'action n'a pas pu se faire. Une action qui demande une saisie va dans un tiroir.
export function ActionDirecte({
  libelle,
  libelleEnCours = "En cours…",
  action,
  champs,
  variante = "secondaire",
  desactive = false,
  ok,
}: {
  libelle: string
  libelleEnCours?: string
  action: (etat: Resultat | null, donnees: FormData) => Promise<Resultat>
  champs?: Record<string, string>
  variante?: "principale" | "secondaire" | "danger"
  desactive?: boolean
  ok?: string
}) {
  const [etat, envoyer, enCours] = useActionState(action, null)
  const classe = variante === "principale" ? BOUTON : variante === "danger" ? BOUTON_DANGER : BOUTON_SECONDAIRE

  return (
    <form action={envoyer} className="flex flex-col gap-2">
      {Object.entries(champs ?? {}).map(([nom, valeur]) => (
        <input key={nom} type="hidden" name={nom} value={valeur} />
      ))}
      <button type="submit" disabled={enCours || desactive} className={`${classe} w-fit`}>
        {enCours ? libelleEnCours : libelle}
      </button>
      <Message resultat={etat} ok={ok} />
    </form>
  )
}
