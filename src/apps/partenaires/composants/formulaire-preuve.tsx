"use client"

// Preuve d'une contrepartie : une photo (ChampFichier) ou un lien https, la date, l'épreuve, un commentaire,
// et l'interrupteur « Visible par le partenaire ».

import { useState } from "react"

import { ChampFichier } from "@/components/formulaire/champ-fichier"
import { CHAMP } from "@/lib/classes-formulaire"

import { LIBELLES_TYPE_PREUVE } from "../affichage"
import { ajouterPreuveAction } from "../actions"

import { BoutonEnvoi, Champ, FormulaireAction } from "./formulaire"

const IMAGES = "image/jpeg,image/png,image/webp"

export function FormulairePreuve({
  benefitId,
  epreuves,
  aujourdhui,
}: {
  benefitId: string
  epreuves: { id: string; nom: string }[]
  aujourdhui: string
}) {
  const [type, setType] = useState("photo")
  const [fichier, setFichier] = useState<string | null>(null)
  const identifiant = `preuve-${benefitId}`

  return (
    <FormulaireAction action={ajouterPreuveAction} nom="Ajouter une preuve" className="flex flex-col gap-4">
      <input type="hidden" name="benefitId" value={benefitId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id={`${identifiant}-date`} libelle="Date">
          <input id={`${identifiant}-date`} name="date" type="date" required defaultValue={aujourdhui} className={CHAMP} />
        </Champ>
        <Champ id={`${identifiant}-type`} libelle="Type">
          <select id={`${identifiant}-type`} name="type" value={type} onChange={(e) => setType(e.target.value)} className={CHAMP}>
            {Object.entries(LIBELLES_TYPE_PREUVE).map(([cle, libelleType]) => (
              <option key={cle} value={cle}>
                {libelleType}
              </option>
            ))}
          </select>
        </Champ>
        <Champ id={`${identifiant}-epreuve`} libelle="Épreuve">
          <select id={`${identifiant}-epreuve`} name="eventId" defaultValue="" className={CHAMP}>
            <option value="">Aucune épreuve</option>
            {epreuves.map((epreuve) => (
              <option key={epreuve.id} value={epreuve.id}>
                {epreuve.nom}
              </option>
            ))}
          </select>
        </Champ>
      </div>

      {type === "lien" ? (
        <Champ id={`${identifiant}-lien`} libelle="Lien" aide="Une adresse qui commence par https://">
          <input id={`${identifiant}-lien`} name="lien" type="url" placeholder="https://" maxLength={500} className={CHAMP} aria-describedby={`${identifiant}-lien-aide`} />
        </Champ>
      ) : (
        <ChampFichier app="partenaires" accept={IMAGES} libelle="Photo" valeur={fichier} typeValeur="image/*" name="fileId" onChange={(f) => setFichier(f?.id ?? null)} />
      )}

      <Champ id={`${identifiant}-commentaire`} libelle="Commentaire">
        <textarea id={`${identifiant}-commentaire`} name="commentaire" rows={2} maxLength={1000} className={CHAMP} />
      </Champ>

      <label className="cible-tactile flex items-center gap-3">
        <input type="checkbox" name="visiblePartenaire" defaultChecked className="h-5 w-5 accent-marque" />
        Visible par le partenaire
      </label>

      <div>
        <BoutonEnvoi libelle="Ajouter la preuve" />
      </div>
    </FormulaireAction>
  )
}
