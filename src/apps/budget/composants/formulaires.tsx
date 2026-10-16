"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useActionState } from "react"

import { newId } from "@/core/ids"
import { useMoteurSynchro } from "@/core/synchro/client/react"

import {
  confirmerSuggestionAction,
  creerRecetteAction,
  definirPrevisionnelAction,
  ignorerSuggestionAction,
  rembourserAction,
  type Resultat,
} from "../actions"
import { montantSaisi } from "../saisie"
import { BOUTON, CHAMP } from "./classes"

// --- Messages ----------------------------------------------------------------------------------

function Message({ resultat, ok }: { resultat: Resultat | null; ok?: string }) {
  if (!resultat) return null
  return resultat.ok ? (
    <p role="status" className="text-sm text-etat-ok">
      {ok ?? "Enregistré."}
    </p>
  ) : (
    <p role="alert" className="text-sm text-etat-rouge">
      {resultat.message}
    </p>
  )
}

// Centimes -> « 12,50 » pour un champ de saisie.
export function enEuros(centimes: number): string {
  return (centimes / 100).toFixed(2).replace(".", ",")
}

// --- Nouvelle dépense (trois champs) : écrite dans la base locale, donc utilisable hors ligne ---

export interface OptionsDepense {
  categories: Array<{ id: string; nom: string }>
  payeurs: Array<{ id: string; nom: string; type: string }>
  moiId: string | null
  epreuves: Array<{ id: string; nom: string }>
  epreuveEnCoursId: string | null
  dateDuJour: string
}

export function FormulaireDepense({ options }: { options: OptionsDepense }) {
  const moteur = useMoteurSynchro()
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [enCours, setEnCours] = useState(false)

  // « Moi » en premier, puis la caisse, puis les autres.
  const payeurs = useMemo(
    () =>
      [...options.payeurs].sort((a, b) => (a.id === options.moiId ? -1 : b.id === options.moiId ? 1 : a.type.localeCompare(b.type))),
    [options.payeurs, options.moiId],
  )

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const formulaire = evenement.currentTarget
    const saisie = new FormData(formulaire)
    const centimes = montantSaisi(String(saisie.get("montant") ?? ""))
    if (centimes === null || centimes <= 0) {
      setMessage({ ok: false, texte: "Montant attendu, par exemple 45,50." })
      return
    }
    const categoryId = String(saisie.get("categoryId") ?? "")
    const payerId = String(saisie.get("payerId") ?? "")
    if (!categoryId || !payerId) {
      setMessage({ ok: false, texte: "Choisis une catégorie et qui a payé." })
      return
    }
    const libelle = String(saisie.get("libelle") ?? "").trim()
    const eventId = String(saisie.get("eventId") ?? "")
    setEnCours(true)
    try {
      await moteur.ecrireLocal("budget_expense", {
        type: "creer",
        id: newId(),
        champs: {
          date: String(saisie.get("date") ?? options.dateDuJour),
          montant: centimes,
          categoryId,
          payerId,
          libelle: libelle || null,
          eventId: eventId || null,
        },
      })
      formulaire.reset()
      setMessage({ ok: true, texte: "Enregistré. La dépense part dès que l'appareil est connecté." })
    } catch {
      setMessage({ ok: false, texte: "La dépense n'a pas pu être enregistrée sur cet appareil." })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="montant" className="font-medium">
          Montant (€)
        </label>
        <input id="montant" name="montant" inputMode="decimal" autoFocus required placeholder="0,00" className={`${CHAMP} text-2xl font-mono tabular-nums`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="categoryId" className="font-medium">
          Catégorie
        </label>
        <select id="categoryId" name="categoryId" required defaultValue="" className={CHAMP}>
          <option value="" disabled>
            Choisis une catégorie
          </option>
          {options.categories.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="payerId" className="font-medium">
          Payé par
        </label>
        <select id="payerId" name="payerId" required defaultValue={options.moiId ?? ""} className={CHAMP}>
          {payeurs.map((payeur) => (
            <option key={payeur.id} value={payeur.id}>
              {payeur.id === options.moiId ? "Moi" : payeur.nom}
            </option>
          ))}
        </select>
      </div>
      <details className="flex flex-col gap-4 rounded-md border border-bordure p-4">
        <summary className="cursor-pointer font-medium">Plus de détails</summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="date" className="text-sm text-texte-discret">
              Date
            </label>
            <input id="date" name="date" type="date" defaultValue={options.dateDuJour} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="eventId" className="text-sm text-texte-discret">
              Épreuve
            </label>
            <select id="eventId" name="eventId" defaultValue={options.epreuveEnCoursId ?? ""} className={CHAMP}>
              <option value="">Aucune</option>
              {options.epreuves.map((epreuve) => (
                <option key={epreuve.id} value={epreuve.id}>
                  {epreuve.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="libelle" className="text-sm text-texte-discret">
              Libellé (facultatif, sinon le nom de la catégorie)
            </label>
            <input id="libelle" name="libelle" maxLength={200} className={CHAMP} />
          </div>
        </div>
      </details>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-etat-ok" : "text-etat-rouge"}`}>
          {message.texte}
        </p>
      )}
      <button type="submit" disabled={enCours} className={`${BOUTON} w-full`}>
        Ajouter la dépense
      </button>
    </form>
  )
}

// --- Nouvelle recette ---------------------------------------------------------------------------

export function FormulaireRecette({
  categories,
  payeurs,
  epreuves,
  epreuveEnCoursId,
  dateDuJour,
}: {
  categories: Array<{ id: string; nom: string }>
  payeurs: Array<{ id: string; nom: string }>
  epreuves: Array<{ id: string; nom: string }>
  epreuveEnCoursId: string | null
  dateDuJour: string
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerRecetteAction, null)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="montant" className="font-medium">
          Montant (€)
        </label>
        <input id="montant" name="montant" inputMode="decimal" required className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="categoryId" className="font-medium">
          Catégorie
        </label>
        <select id="categoryId" name="categoryId" required defaultValue="" className={CHAMP}>
          <option value="" disabled>
            Choisis une catégorie
          </option>
          {categories.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="libelle" className="font-medium">
          Libellé
        </label>
        <input id="libelle" name="libelle" required maxLength={200} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm text-texte-discret">
          Date
        </label>
        <input id="date" name="date" type="date" defaultValue={dateDuJour} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="eventId" className="text-sm text-texte-discret">
          Épreuve
        </label>
        <select id="eventId" name="eventId" defaultValue={epreuveEnCoursId ?? ""} className={CHAMP}>
          <option value="">Aucune</option>
          {epreuves.map((epreuve) => (
            <option key={epreuve.id} value={epreuve.id}>
              {epreuve.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="statut" className="text-sm text-texte-discret">
          Statut
        </label>
        <select id="statut" name="statut" defaultValue="prevue" className={CHAMP}>
          <option value="prevue">Prévue</option>
          <option value="encaissee">Encaissée</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="payerId" className="text-sm text-texte-discret">
          Encaissée sur (si encaissée)
        </label>
        <select id="payerId" name="payerId" defaultValue="" className={CHAMP}>
          <option value="">Choisis un compte</option>
          {payeurs.map((payeur) => (
            <option key={payeur.id} value={payeur.id}>
              {payeur.nom}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
        <input type="checkbox" name="enNature" className="size-5" />
        <span>Recette en nature (sans montant en euros)</span>
      </label>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="descriptionNature" className="text-sm text-texte-discret">
          Description de la nature (si en nature)
        </label>
        <input id="descriptionNature" name="descriptionNature" maxLength={300} className={CHAMP} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="valeurEstimee" className="text-sm text-texte-discret">
          Valeur estimée (€, si en nature)
        </label>
        <input id="valeurEstimee" name="valeurEstimee" inputMode="decimal" className={CHAMP} />
      </div>
      <div className="sm:col-span-2">
        <Message resultat={resultat} />
      </div>
      <button type="submit" disabled={enCours} className={`${BOUTON} sm:col-span-2`}>
        Enregistrer la recette
      </button>
    </form>
  )
}

// --- Remboursement à un membre ----------------------------------------------------------------

export function FormulaireRemboursement({
  personne,
  depenses,
  payeurs,
  dateDuJour,
}: {
  personne: { id: string; nom: string }
  depenses: Array<{ id: string; libelle: string; date: string; resteCentimes: number }>
  payeurs: Array<{ id: string; nom: string }>
  dateDuJour: string
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(rembourserAction, null)
  // Par défaut : les plus anciennes dépenses, cochées dans l'ordre, jusqu'à leur reste dû.
  const [cochees, setCochees] = useState<Record<string, boolean>>({})
  const [montants, setMontants] = useState<Record<string, string>>(() => Object.fromEntries(depenses.map((d) => [d.id, enEuros(d.resteCentimes)])))

  const total = depenses.reduce((somme, depense) => {
    if (!cochees[depense.id]) return somme
    return somme + (montantSaisi(montants[depense.id] ?? "") ?? 0)
  }, 0)

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="personId" value={personne.id} />
      <input type="hidden" name="montant" value={enEuros(total)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Dépenses couvertes</legend>
        {depenses.length === 0 && <p className="text-sm text-texte-discret">Aucune dépense à rembourser pour {personne.nom}.</p>}
        {depenses.map((depense) => (
          <div key={depense.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <input
              type="checkbox"
              name="depense"
              value={depense.id}
              aria-label={`Rembourser ${depense.libelle}`}
              checked={cochees[depense.id] ?? false}
              onChange={(e) => setCochees((precedent) => ({ ...precedent, [depense.id]: e.target.checked }))}
              className="size-5"
            />
            <span className="text-sm">
              {depense.date} · {depense.libelle}
            </span>
            <input
              name={`montant-${depense.id}`}
              inputMode="decimal"
              aria-label={`Montant pour ${depense.libelle}`}
              value={montants[depense.id] ?? ""}
              onChange={(e) => setMontants((precedent) => ({ ...precedent, [depense.id]: e.target.value }))}
              className={`${CHAMP} w-28 text-right font-mono tabular-nums`}
            />
          </div>
        ))}
      </fieldset>
      <p className="font-mono tabular-nums">Total à rembourser : {enEuros(total)} €</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-sm text-texte-discret">
            Date
          </label>
          <input id="date" name="date" type="date" defaultValue={dateDuJour} className={CHAMP} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="moyen" className="text-sm text-texte-discret">
            Moyen
          </label>
          <select id="moyen" name="moyen" defaultValue="virement" className={CHAMP}>
            <option value="virement">Virement</option>
            <option value="cheque">Chèque</option>
            <option value="especes">Espèces</option>
            <option value="carte">Carte</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="payerId" className="text-sm text-texte-discret">
            Payé depuis
          </label>
          <select id="payerId" name="payerId" required defaultValue="" className={CHAMP}>
            <option value="" disabled>
              Choisis le compte
            </option>
            {payeurs.map((payeur) => (
              <option key={payeur.id} value={payeur.id}>
                {payeur.nom}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Message resultat={resultat} ok={`Remboursement enregistré pour ${personne.nom}.`} />
      <button type="submit" disabled={enCours || total <= 0} className={BOUTON}>
        Rembourser
      </button>
    </form>
  )
}

// --- Prévisionnel : une ligne par catégorie ----------------------------------------------------

export function LignePrevisionnel({ seasonId, categorie, prevuCentimes }: { seasonId: string; categorie: { id: string; nom: string }; prevuCentimes: number | null }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(definirPrevisionnelAction, null)
  return (
    <form action={action} className="grid items-center gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="categoryId" value={categorie.id} />
      <span className="font-medium">{categorie.nom}</span>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Prévu pour {categorie.nom} (€)</span>
        <input name="montant" inputMode="decimal" defaultValue={prevuCentimes === null ? "" : enEuros(prevuCentimes)} className={`${CHAMP} w-32 text-right font-mono tabular-nums`} />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={enCours} className="cible-tactile rounded-md border border-bordure px-3 py-2 text-sm">
          Enregistrer
        </button>
        <Message resultat={resultat} ok="Enregistré." />
      </div>
    </form>
  )
}

// --- Suggestions : confirmer (payeur et catégorie modifiables) ou ignorer ----------------------

export function ActionsSuggestion({
  id,
  payeurs,
  payeurId,
  categories,
  categorieId,
}: {
  id: string
  payeurs: Array<{ id: string; nom: string }>
  payeurId: string | null
  categories: Array<{ id: string; nom: string }>
  categorieId: string
}) {
  const [confirmation, actionConfirmer, enCoursConfirmer] = useActionState<Resultat | null, FormData>(confirmerSuggestionAction, null)
  const [ignoration, actionIgnorer, enCoursIgnorer] = useActionState<Resultat | null, FormData>(ignorerSuggestionAction, null)
  return (
    <div className="flex flex-col gap-3">
      <form action={actionConfirmer} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texte-discret">Payé par</span>
          <select name="payerId" defaultValue={payeurId ?? ""} className={CHAMP}>
            {payeurs.map((payeur) => (
              <option key={payeur.id} value={payeur.id}>
                {payeur.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texte-discret">Catégorie</span>
          <select name="categoryId" defaultValue={categorieId} className={CHAMP}>
            {categories.map((categorie) => (
              <option key={categorie.id} value={categorie.id}>
                {categorie.nom}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={enCoursConfirmer} className={BOUTON}>
            Confirmer
          </button>
          <Message resultat={confirmation} ok="Confirmé." />
        </div>
      </form>
      <form action={actionIgnorer} className="flex items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={enCoursIgnorer} className="cible-tactile rounded-md border border-bordure px-5 py-3 text-sm">
          Ignorer
        </button>
        <Message resultat={ignoration} ok="Ignoré." />
      </form>
    </div>
  )
}
