"use client"

// Formulaire « Laisser un message » de la page partenaire (brief 3.7, §6). Le jeton part dans un champ caché, et
// l'action le revalide. Le champ « site » est un piège : il est caché aux personnes, et rempli seulement par un robot.

import { useActionState, useEffect, useRef, useState } from "react"

import { Message } from "@/components/formulaire/message"
import { CHAMP } from "@/lib/classes-formulaire"

import { envoyerMessagePartenaireAction } from "../actions-public"

import { BoutonEnvoi, Champ } from "./formulaire"

const MESSAGE_MERCI = "Merci, votre message a bien été transmis à la team."
const MESSAGE_MAX = 2000
// Le lecteur d'écran n'annonce la limite qu'à partir de 1 800 caractères, et seulement à chaque palier de 50 caractères
// restants : jamais à chaque frappe (brief 3.10, §4).
const SEUIL_ANNONCE = 1800
const PAS_ANNONCE = 50

// Même formatage que les montants (« 2 000 » avec une espace ordinaire, comme dans regles.ts).
const formater = (nombre: number) => String(nombre).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

function annoncePour(longueur: number): string {
  const restant = MESSAGE_MAX - longueur
  if (restant > MESSAGE_MAX - SEUIL_ANNONCE) return ""
  if (restant <= 0) return "Limite atteinte."
  return `Il reste ${Math.ceil(restant / PAS_ANNONCE) * PAS_ANNONCE} caractères au plus.`
}

export function FormulaireMessagePartenaire({ jeton }: { jeton: string }) {
  const [resultat, envoyer] = useActionState(envoyerMessagePartenaireAction, null)
  const formulaire = useRef<HTMLFormElement>(null)
  const [longueur, setLongueur] = useState(0)
  const [annonce, setAnnonce] = useState("")
  const [monte, setMonte] = useState(false)

  useEffect(() => setMonte(true), [])

  // Après un envoi réussi, le formulaire repart vide : pas de double envoi par mégarde, et le compteur repart à zéro.
  useEffect(() => {
    if (resultat?.ok) {
      formulaire.current?.reset()
      setLongueur(0)
      setAnnonce("")
    }
  }, [resultat])

  const suivreFrappe = (texte: string) => {
    setLongueur(texte.length)
    setAnnonce(annoncePour(texte.length))
  }

  return (
    <form ref={formulaire} action={envoyer} aria-label="Laisser un message" className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={jeton} />
      <div aria-hidden className="hidden">
        <label>
          Site
          <input name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Champ id="message-nom" libelle="Votre nom">
        <input id="message-nom" name="nom" required maxLength={100} autoComplete="name" className={CHAMP} />
      </Champ>
      <Champ id="message-texte" libelle="Votre message">
        <textarea
          id="message-texte"
          name="message"
          required
          maxLength={MESSAGE_MAX}
          rows={5}
          className={CHAMP}
          aria-describedby={monte ? "message-compteur" : undefined}
          onChange={(evenement) => suivreFrappe(evenement.currentTarget.value)}
        />
        {/* Le compteur n'apparaît qu'une fois le formulaire monté dans le navigateur : sans JavaScript, il n'y a que le champ. */}
        {monte && (
          <>
            <p id="message-compteur" className="text-sm text-texte-discret">
              {formater(longueur)} / {formater(MESSAGE_MAX)} caractères
            </p>
            <span role="status" className="sr-only">
              {annonce}
            </span>
          </>
        )}
      </Champ>
      <Message resultat={resultat} ok={MESSAGE_MERCI} />
      <div>
        <BoutonEnvoi libelle="Envoyer le message" />
      </div>
    </form>
  )
}
