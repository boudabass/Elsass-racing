"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, CHAMP } from "@/lib/classes-formulaire"

import { creerReglageAction, modifierReglageAction } from "../actions"
import { CHAMPS_REGLAGE, type ChampReglage } from "../regles"
import { LIBELLE_CONDITIONS, LIBELLE_REVETEMENT } from "../libelles"

export interface OptionEpreuveReglage {
  valeur: string
  libelle: string
}

// Valeurs affichées : texte, avec la virgule comme séparateur décimal.
export interface ValeursFormulaireReglage {
  date: string
  epreuve: string
  conditions: string
  revetement: string
  remarques: string
  note: string
  valeurs: Record<string, string>
}

interface Props {
  vehicleId: string
  // Présent en modification : la fiche existante, et l'action qui la remplace.
  reglageId?: string
  initiales: ValeursFormulaireReglage
  masques: string[]
  epreuves: OptionEpreuveReglage[]
  // Référence utilisée pour partir de (sa clé de modèle), ou null.
  modeleId: string | null
}

const ESSENTIELS = CHAMPS_REGLAGE.filter((c) => c.groupe === "essentiel")
const AVANCES = CHAMPS_REGLAGE.filter((c) => c.groupe === "avance")
const PNEUS = ["avg", "avd", "arg", "ard"] as const

// Nouvelle fiche ou modification. Les champs masqués par la team ne s'affichent pas : en modification, leur
// valeur part dans un champ caché, pour que la modification ne la perde pas (la fiche garde toutes ses valeurs).
export function FormulaireReglage({ vehicleId, reglageId, initiales, masques, epreuves, modeleId }: Props) {
  const router = useRouter()
  const action = reglageId ? modifierReglageAction : creerReglageAction
  const [resultat, envoyer, enCours] = useActionState<Resultat | null, FormData>(action, null)

  useEffect(() => {
    if (!resultat?.ok) return
    const cible = resultat.id ?? reglageId
    if (cible) router.push(`/apps/voiture/vehicules/${vehicleId}/reglages/${cible}`)
  }, [resultat, router, reglageId, vehicleId])

  const champ = (c: ChampReglage) => (
    <label key={c.cle} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{c.libelle}</span>
      <span className="flex items-center gap-2">
        <input name={`v_${c.cle}`} defaultValue={initiales.valeurs[c.cle] ?? ""} inputMode="decimal" autoComplete="off" className={`${CHAMP} tabular-nums`} />
        {c.unite && <span className="shrink-0 text-texte-discret">{c.unite}</span>}
      </span>
    </label>
  )

  return (
    <form action={envoyer} className="flex flex-col gap-6">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {reglageId && <input type="hidden" name="reglageId" value={reglageId} />}
      {modeleId && <input type="hidden" name="modeleId" value={modeleId} />}
      {reglageId &&
        masques.map((cle) => <input key={cle} type="hidden" name={`v_${cle}`} value={initiales.valeurs[cle] ?? ""} />)}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Date</span>
          <input name="date" type="date" required defaultValue={initiales.date} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Épreuve</span>
          <select name="epreuve" defaultValue={initiales.epreuve} className={CHAMP}>
            <option value="">Aucune</option>
            {epreuves.map((epreuve) => (
              <option key={epreuve.valeur} value={epreuve.valeur}>
                {epreuve.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Conditions</span>
          <select name="conditions" defaultValue={initiales.conditions} className={CHAMP}>
            <option value="">Non précisées</option>
            {Object.entries(LIBELLE_CONDITIONS).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Revêtement</span>
          <select name="revetement" defaultValue={initiales.revetement} className={CHAMP}>
            <option value="">Non précisé</option>
            {Object.entries(LIBELLE_REVETEMENT).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-titre text-lg uppercase">Pressions</legend>
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          {(["pression_froid", "pression_chaud"] as const).map((prefixe) => (
            <div key={prefixe} className="col-span-2 grid grid-cols-2 gap-4">
              <p className="col-span-2 text-sm font-medium">{prefixe === "pression_froid" ? "À froid" : "À chaud"}</p>
              {PNEUS.map((cote) => {
                const c = ESSENTIELS.find((e) => e.cle === `${prefixe}_${cote}`)
                return c ? champ({ ...c, libelle: cote.toUpperCase() }) : null
              })}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-titre text-lg uppercase">Hauteur de caisse</legend>
        <div className="grid gap-4 sm:grid-cols-2">{ESSENTIELS.filter((c) => c.cle.startsWith("hauteur_")).map(champ)}</div>
      </fieldset>

      {AVANCES.some((c) => !masques.includes(c.cle)) && (
        <details className="rounded-lg border border-bordure p-4">
          <summary className="cible-tactile cursor-pointer font-medium">Plus de réglages</summary>
          <div className="grid gap-4 pt-4 sm:grid-cols-2">{AVANCES.filter((c) => !masques.includes(c.cle)).map(champ)}</div>
        </details>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Remarques du pilote</span>
        <textarea name="remarques" rows={3} maxLength={2000} defaultValue={initiales.remarques} className={CHAMP} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Comportement de la voiture (1 à 5)</legend>
        <div className="flex flex-wrap gap-2">
          {["", "1", "2", "3", "4", "5"].map((valeur) => (
            <label key={valeur || "aucune"} className="cible-tactile flex items-center gap-2 rounded-md border border-bordure px-3 text-sm has-[:checked]:border-marque has-[:checked]:font-medium">
              <input type="radio" name="note" value={valeur} defaultChecked={initiales.note === valeur} className="h-4 w-4" />
              {valeur === "" ? "Pas de note" : valeur}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={enCours} className={`${BOUTON} w-full sm:w-auto`}>
          Enregistrer la fiche
        </button>
        <Message resultat={resultat} />
      </div>
    </form>
  )
}
