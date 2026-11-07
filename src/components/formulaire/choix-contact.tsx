"use client"

// Un choix de contact dans un formulaire (5.8b) : un contact de la team (liste), ou « Nouveau… » qui ouvre un champ nom dans le
// même tiroir. Un seul des deux part avec le formulaire : le champ fermé n'est pas rendu, donc pas envoyé. Le service de
// l'app reçoit l'un ou l'autre (contactDuChoix dans src/core/contacts/contacts-serveur.ts).

import { useState, type ReactNode } from "react"

import { CHAMP, LIEN } from "@/lib/classes-formulaire"

export interface ChoixContactProps {
  // Libellé du champ liste, et son nom d'envoi.
  libelle: string
  nomListe: string
  // Nom d'envoi du champ « nouveau », et ses libellés à l'écran.
  nomNouveau: string
  libelleNouveau: string
  libelleNom: string
  libelleRetour: string
  options: Array<{ id: string; nom: string }>
  valeur?: string | null
  // Requis : la liste ne propose pas « Aucun » et le nouveau nom est obligatoire.
  requis?: boolean
  // Texte de l'option vide (« Aucun », « Choisir le fournisseur »).
  aucun: string
  aide?: ReactNode
  // Limite du nom (même limite que le service, 120 caractères).
  maxLength?: number
}

export function ChoixContact({
  libelle,
  nomListe,
  nomNouveau,
  libelleNouveau,
  libelleNom,
  libelleRetour,
  options,
  valeur,
  requis = false,
  aucun,
  aide,
  maxLength = 120,
}: ChoixContactProps) {
  const [nouveau, setNouveau] = useState(false)

  if (nouveau) {
    return (
      <>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{libelleNom}</span>
          <input name={nomNouveau} aria-label={libelleNom} required={requis} maxLength={maxLength} className={CHAMP} />
        </label>
        <button type="button" onClick={() => setNouveau(false)} className={LIEN}>
          {libelleRetour}
        </button>
      </>
    )
  }

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{libelle}</span>
        <select name={nomListe} aria-label={libelle} required={requis} defaultValue={valeur ?? ""} className={CHAMP}>
          {requis ? (
            <option value="" disabled>
              {aucun}
            </option>
          ) : (
            <option value="">{aucun}</option>
          )}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.nom}
            </option>
          ))}
        </select>
        {aide && <span className="text-texte-discret">{aide}</span>}
      </label>
      <button type="button" onClick={() => setNouveau(true)} className={LIEN}>
        {libelleNouveau}
      </button>
    </>
  )
}
