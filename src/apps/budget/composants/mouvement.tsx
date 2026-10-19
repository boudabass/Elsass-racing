"use client"

import { useState } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { formatEuros } from "@/lib/euros"

import { modifierMouvementAction, supprimerMouvementAction } from "../actions"
import { enEuros } from "./formulaires"
import { CHAMP } from "./classes"

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

const LIBELLE_MOYEN: Record<string, string> = {
  virement: "Virement",
  cheque: "Chèque",
  especes: "Espèces",
  carte: "Carte",
}

interface Options {
  valeurs: ValeursMouvement
  categories: Array<{ id: string; nom: string }>
  payeurs: Array<{ id: string; nom: string }>
  epreuves: Array<{ id: string; nom: string }>
  peutChoisirPayeur: boolean
}

// Fiche d'un mouvement : les valeurs se lisent, « Modifier » ouvre le tiroir de saisie, « Supprimer » un tiroir de confirmation
// (brief 3.13, règles 6 et 7).
export function FicheMouvement(options: Options) {
  const { valeurs, categories, payeurs, epreuves } = options
  const estDepense = valeurs.type === "depense"
  const categorie = categories.find((c) => c.id === valeurs.categorieId)?.nom ?? "—"
  const epreuve = epreuves.find((e) => e.id === valeurs.eventId)?.nom ?? "Aucune"
  const payeur = payeurs.find((p) => p.id === valeurs.payerId)?.nom ?? "—"

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <dt className="text-texte-discret">Montant</dt>
        <dd className="chiffre font-medium">{formatEuros(valeurs.montantCentimes)}</dd>
        <dt className="text-texte-discret">Catégorie</dt>
        <dd>{categorie}</dd>
        <dt className="text-texte-discret sm:col-span-2">Libellé</dt>
        <dd className="sm:col-span-2">{valeurs.libelle}</dd>
        <dt className="text-texte-discret">Date</dt>
        <dd>{valeurs.date}</dd>
        <dt className="text-texte-discret">Épreuve</dt>
        <dd>{epreuve}</dd>
        {estDepense && (
          <>
            <dt className="text-texte-discret">Payé par</dt>
            <dd>{payeur}</dd>
            <dt className="text-texte-discret">Moyen</dt>
            <dd>{(valeurs.moyen && LIBELLE_MOYEN[valeurs.moyen]) ?? "Non précisé"}</dd>
            <dt className="text-texte-discret">Ticket</dt>
            <dd>
              {valeurs.justificatif ? (
                <a href={`/api/fichiers/${valeurs.justificatif.id}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  Voir la photo du ticket
                </a>
              ) : (
                "Aucun"
              )}
            </dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-3">
        <TiroirAction
          libelle="Modifier"
          titre="Modifier le mouvement"
          action={modifierMouvementAction}
          libelleBouton="Enregistrer les modifications"
          libelleEnCours="Enregistrement…"
          secondaire={false}
        >
          <input type="hidden" name="id" value={valeurs.id} />
          <input type="hidden" name="type" value={valeurs.type} />
          <CorpsMouvement {...options} />
        </TiroirAction>
        <TiroirAction
          libelle="Supprimer"
          titre="Supprimer le mouvement"
          action={supprimerMouvementAction}
          libelleBouton="Supprimer"
          libelleEnCours="Suppression…"
          danger
          question="Le mouvement disparaît de la liste. Cette action ne se défait pas."
        >
          <input type="hidden" name="id" value={valeurs.id} />
          <input type="hidden" name="type" value={valeurs.type} />
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="confirme" required className="size-5" />
            <span className="text-sm">Je confirme la suppression de ce mouvement.</span>
          </label>
        </TiroirAction>
      </div>
    </div>
  )
}

// Les champs du mouvement, dans le tiroir de modification. Une seule colonne : le tiroir fait 480 px.
function CorpsMouvement({ valeurs, categories, payeurs, epreuves, peutChoisirPayeur }: Options) {
  const [ticket, setTicket] = useState<Pick<FichierEnvoye, "id" | "nom" | "mimeType"> | null>(valeurs.justificatif)
  const estDepense = valeurs.type === "depense"
  return (
    <>
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
      <label className="flex flex-col gap-1 text-sm">
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
        </>
      )}
    </>
  )
}
