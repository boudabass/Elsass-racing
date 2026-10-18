"use client"

// Formulaire « Laisser un message » de la page partenaire (brief 3.7, §6). Le jeton part dans un champ caché, et
// l'action le revalide. Le champ « site » est un piège : il est caché aux personnes, et rempli seulement par un robot.

import { useActionState, useEffect, useRef } from "react"

import { Message } from "@/components/formulaire/message"
import { CHAMP } from "@/lib/classes-formulaire"

import { envoyerMessagePartenaireAction } from "../actions-public"

import { BoutonEnvoi, Champ } from "./formulaire"

const MESSAGE_MERCI = "Merci, votre message a bien été transmis à la team."

export function FormulaireMessagePartenaire({ jeton }: { jeton: string }) {
  const [resultat, envoyer] = useActionState(envoyerMessagePartenaireAction, null)
  const formulaire = useRef<HTMLFormElement>(null)

  // Après un envoi réussi, le formulaire repart vide : pas de double envoi par mégarde.
  useEffect(() => {
    if (resultat?.ok) formulaire.current?.reset()
  }, [resultat])

  return (
    <form ref={formulaire} action={envoyer} aria-label="Laisser un message" className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={jeton} />
      <div aria-hidden className="hidden">
        <label>
          Site
          <input name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Champ id="message-nom" libelle="Ton nom">
        <input id="message-nom" name="nom" required maxLength={100} autoComplete="name" className={CHAMP} />
      </Champ>
      <Champ id="message-texte" libelle="Ton message">
        <textarea id="message-texte" name="message" required maxLength={2000} rows={5} className={CHAMP} />
      </Champ>
      <Message resultat={resultat} ok={MESSAGE_MERCI} />
      <div>
        <BoutonEnvoi libelle="Envoyer le message" />
      </div>
    </form>
  )
}
