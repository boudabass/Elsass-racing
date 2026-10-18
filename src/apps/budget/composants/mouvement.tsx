"use client"

import { useActionState, useState } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"

import { modifierMouvementAction, supprimerMouvementAction, type Resultat } from "../actions"
import { enEuros } from "./formulaires"
import { BOUTON, CHAMP } from "./classes"

export interface ValeursMouvement {
  id: string
  type: "depense" | "recette"
  montantCentimes: number
  categorieId: string
  libelle: string
  date: string
  eventId: string | null
  payerId: string | null
  moyen: string | null
  justificatif: { id: string; nom: string; mimeType: string } | null
}

// Modifier un mouvement (mêmes champs que la création) et le supprimer après case cochée.
export function FormulaireMouvement({
  valeurs,
  categories,
  payeurs,
  epreuves,
  peutChoisirPayeur,
}: {
  valeurs: ValeursMouvement
  categories: Array<{ id: string; nom: string }>
  payeurs: Array<{ id: string; nom: string }>
  epreuves: Array<{ id: string; nom: string }>
  peutChoisirPayeur: boolean
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(modifierMouvementAction, null)
  const [suppression, actionSupprimer, enCoursSupprimer] = useActionState<Resultat | null, FormData>(supprimerMouvementAction, null)
  // Ticket courant (ou envoyé à l'instant) : son id part avec le formulaire, son type choisit la vignette.
  const [ticket, setTicket] = useState<Pick<FichierEnvoye, "id" | "nom" | "mimeType"> | null>(valeurs.justificatif)
  const estDepense = valeurs.type === "depense"
  return (
    <div className="flex flex-col gap-8">
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={valeurs.id} />
        <input type="hidden" name="type" value={valeurs.type} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Montant (€)</span>
          <input name="montant" inputMode="decimal" defaultValue={enEuros(valeurs.montantCentimes)} required className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Catégorie</span>
          <select name="categoryId" defaultValue={valeurs.categorieId} required className={CHAMP}>
            {categories.map((categorie) => (
              <option key={categorie.id} value={categorie.id}>
                {categorie.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Libellé</span>
          <input name="libelle" defaultValue={valeurs.libelle} required maxLength={200} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texte-discret">Date</span>
          <input name="date" type="date" defaultValue={valeurs.date} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texte-discret">Épreuve</span>
          <select name="eventId" defaultValue={valeurs.eventId ?? ""} className={CHAMP}>
            <option value="">Aucune</option>
            {epreuves.map((epreuve) => (
              <option key={epreuve.id} value={epreuve.id}>
                {epreuve.nom}
              </option>
            ))}
          </select>
        </label>
        {estDepense && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-texte-discret">Payé par</span>
              <select name={peutChoisirPayeur ? "payerId" : undefined} defaultValue={valeurs.payerId ?? ""} disabled={!peutChoisirPayeur} className={CHAMP}>
                {payeurs.map((payeur) => (
                  <option key={payeur.id} value={payeur.id}>
                    {payeur.nom}
                  </option>
                ))}
              </select>
              {!peutChoisirPayeur && <input type="hidden" name="payerId" value={valeurs.payerId ?? ""} />}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-texte-discret">Moyen</span>
              <select name="moyen" defaultValue={valeurs.moyen ?? ""} className={CHAMP}>
                <option value="">Non précisé</option>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="especes">Espèces</option>
                <option value="carte">Carte</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <ChampFichier
                app="budget"
                libelle={ticket ? "Remplacer la photo du ticket" : "Ajouter la photo du ticket"}
                valeur={ticket?.id ?? null}
                typeValeur={ticket?.mimeType ?? null}
                nomValeur={ticket?.nom ?? null}
                onChange={setTicket}
                name="justificatifFileId"
                libelleRetirer="Retirer la photo"
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={enCours} className={BOUTON}>
            Enregistrer les modifications
          </button>
          {resultat &&
            (resultat.ok ? (
              <p role="status" className="text-sm text-etat-ok">
                Enregistré.
              </p>
            ) : (
              <p role="alert" className="text-sm text-etat-rouge">
                {resultat.message}
              </p>
            ))}
        </div>
      </form>

      <form id="supprimer" action={actionSupprimer} className="flex scroll-mt-24 flex-col gap-3 rounded-md border border-bordure p-4">
        <input type="hidden" name="id" value={valeurs.id} />
        <input type="hidden" name="type" value={valeurs.type} />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="confirme" className="size-5" />
          <span className="text-sm">Je confirme la suppression de ce mouvement.</span>
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={enCoursSupprimer} className="cible-tactile rounded-md border border-etat-rouge px-5 py-3 text-etat-rouge">
            Supprimer
          </button>
          {suppression && !suppression.ok && (
            <p role="alert" className="text-sm text-etat-rouge">
              {suppression.message}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
