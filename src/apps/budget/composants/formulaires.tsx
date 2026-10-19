"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, type FormEvent } from "react"
import { useActionState } from "react"


import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import { TiroirAction, TiroirFormulaire } from "@/components/formulaire/tiroir"
import { newId } from "@/core/ids"
import { useMoteurSynchro } from "@/core/synchro/client/react"
import { enEuros } from "@/lib/euros"
import { BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"

export { enEuros }

import {
  confirmerSuggestionAction,
  creerRecetteAction,
  ignorerSuggestionAction,
  rembourserAction,
  type Resultat,
} from "../actions"
import { montantSaisi } from "../saisie"
import { BOUTON, CHAMP } from "./classes"

// --- Nouvelle dépense (trois champs) : écrite dans la base locale, donc utilisable hors ligne ---

export interface OptionsDepense {
  categories: Array<{ id: string; nom: string }>
  categorieEngagementId: string | null
  engagements: Array<{ id: string; eventId: string; libelle: string }>
  payeurs: Array<{ id: string; nom: string; type: string }>
  moiId: string | null
  epreuves: Array<{ id: string; nom: string }>
  epreuveEnCoursId: string | null
  dateDuJour: string
}

export function FormulaireDepense({ options }: { options: OptionsDepense }) {
  const moteur = useMoteurSynchro()
  const [message, setMessage] = useState<{ ok: boolean; texte: string; boite?: boolean } | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Catégorie, épreuve et engagement : contrôlés, pour préremplir l'engagement concerné.
  const [categorieChoisie, setCategorieChoisie] = useState("")
  const [epreuveChoisie, setEpreuveChoisie] = useState(options.epreuveEnCoursId ?? "")
  const [engagementChoisi, setEngagementChoisi] = useState("")
  // Photo du ticket (facultative) : envoyée au choix, son id part avec la dépense.
  const [ticket, setTicket] = useState<FichierEnvoye | null>(null)

  // Catégorie Engagement et épreuve choisies : l'engagement de cette épreuve est prérempli s'il n'y en a qu'un ;
  // s'il y en a plusieurs, ils sont proposés en tête, sans rien choisir à la place de la personne.
  const engagementsDeLaCategorie = categorieChoisie !== "" && categorieChoisie === options.categorieEngagementId
  function prechoisirEngagement(categorie: string, epreuve: string) {
    const concernes = categorie === options.categorieEngagementId && epreuve ? options.engagements.filter((entree) => entree.eventId === epreuve) : []
    setEngagementChoisi(concernes.length === 1 ? concernes[0].id : "")
  }
  const engagementsAffiches = useMemo(() => {
    if (!engagementsDeLaCategorie || !epreuveChoisie) return options.engagements
    return [...options.engagements].sort((a, b) => Number(b.eventId === epreuveChoisie) - Number(a.eventId === epreuveChoisie))
  }, [options.engagements, engagementsDeLaCategorie, epreuveChoisie])

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
    const entryId = String(saisie.get("entryId") ?? "")
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
          entryId: entryId || null,
          justificatifFileId: ticket?.id ?? null,
        },
      })
      formulaire.reset()
      setCategorieChoisie("")
      setEpreuveChoisie(options.epreuveEnCoursId ?? "")
      setEngagementChoisi("")
      setTicket(null)
      setMessage({ ok: true, texte: "Enregistré. La dépense part dès que l'appareil est connecté.", boite: entryId !== "" })
    } catch {
      setMessage({ ok: false, texte: "La dépense n'a pas pu être enregistrée sur cet appareil." })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <FormulairePage formulaireId="depense-formulaire" annulerHref="/apps/budget" libelleBouton="Ajouter la dépense" enCours={enCours}>
    <form id="depense-formulaire" onSubmit={enregistrer} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="montant" className="font-medium">
          Montant (€)
        </label>
        <input id="montant" name="montant" inputMode="decimal" autoFocus required placeholder="0,00" className={`${CHAMP} text-2xl chiffre`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="categoryId" className="font-medium">
          Catégorie
        </label>
        <select id="categoryId" name="categoryId" required value={categorieChoisie} onChange={(evenement) => { setCategorieChoisie(evenement.target.value); prechoisirEngagement(evenement.target.value, epreuveChoisie) }} className={CHAMP}>
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
      <ChampFichier
        app="budget"
        libelle="Photo du ticket (facultatif)"
        valeur={ticket?.id ?? null}
        typeValeur={ticket?.mimeType ?? null}
        nomValeur={ticket?.nom ?? null}
        onChange={setTicket}
      />
      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Plus de détails</h2>
        <div className="flex flex-col gap-4">
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
            <select
              id="eventId"
              name="eventId"
              value={epreuveChoisie}
              onChange={(evenement) => {
                setEpreuveChoisie(evenement.target.value)
                prechoisirEngagement(categorieChoisie, evenement.target.value)
              }}
              className={CHAMP}
            >
              <option value="">Aucune</option>
              {options.epreuves.map((epreuve) => (
                <option key={epreuve.id} value={epreuve.id}>
                  {epreuve.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="entryId" className="text-sm text-texte-discret">
              Engagement concerné (pour un engagement d'épreuve)
            </label>
            <select id="entryId" name="entryId" value={engagementChoisi} onChange={(evenement) => setEngagementChoisi(evenement.target.value)} className={CHAMP}>
              <option value="">Aucun</option>
              {engagementsAffiches.map((entree) => (
                <option key={entree.id} value={entree.id}>
                  {entree.libelle}
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
      </section>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-etat-ok" : "text-etat-rouge"}`}>
          {message.texte}
          {message.boite && (
            <>
              {" "}
              Si cet engagement reste à payer, une action attend dans la <Link href="/qg" className={LIEN}>boîte d'actions</Link>, une fois l'appareil connecté.
            </>
          )}
        </p>
      )}
    </form>
    </FormulairePage>
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
    <FormulairePage formulaireId="recette-formulaire" annulerHref="/apps/budget" libelleBouton="Enregistrer la recette" enCours={enCours}>
    <form id="recette-formulaire" action={action} className="grid gap-4 sm:grid-cols-2">
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
    </form>
    </FormulairePage>
  )
}

// --- Remboursement à un membre ----------------------------------------------------------------

// Remboursement : un tiroir de saisie, ouvert par le lien « Rembourser » de la liste. Sa fermeture revient à la liste.
export function FormulaireRemboursement({
  personne,
  depenses,
  payeurs,
  dateDuJour,
  fermerHref,
}: {
  personne: { id: string; nom: string }
  depenses: Array<{ id: string; libelle: string; date: string; resteCentimes: number }>
  payeurs: Array<{ id: string; nom: string }>
  dateDuJour: string
  fermerHref: string
}) {
  const router = useRouter()
  // Par défaut : les plus anciennes dépenses, cochées dans l'ordre, jusqu'à leur reste dû.
  const [cochees, setCochees] = useState<Record<string, boolean>>({})
  const [montants, setMontants] = useState<Record<string, string>>(() => Object.fromEntries(depenses.map((d) => [d.id, enEuros(d.resteCentimes)])))

  const total = depenses.reduce((somme, depense) => {
    if (!cochees[depense.id]) return somme
    return somme + (montantSaisi(montants[depense.id] ?? "") ?? 0)
  }, 0)

  return (
    <TiroirFormulaire
      ouvert
      onOuvertChange={(suivant) => {
        if (!suivant) router.push(fermerHref)
      }}
      titre={`Rembourser ${personne.nom}`}
      action={rembourserAction}
      libelleBouton="Enregistrer le remboursement"
      libelleEnCours="Remboursement…"
      desactive={total <= 0}
    >
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
              className={`${CHAMP} w-28 text-right chiffre`}
            />
          </div>
        ))}
      </fieldset>
      <p className="chiffre">Total à rembourser : {enEuros(total)} €</p>
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
    </TiroirFormulaire>
  )
}

// --- Prévisionnel : une ligne par catégorie ----------------------------------------------------

// --- Suggestions : confirmer (payeur et catégorie modifiables) ou ignorer ----------------------

// Une suggestion : « Confirmer » ouvre un tiroir de saisie (payeur et catégorie), « Ignorer » un tiroir de confirmation.
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
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TiroirAction
        libelle="Confirmer"
        titre="Confirmer le mouvement"
        action={confirmerSuggestionAction}
        libelleBouton="Confirmer le mouvement"
        libelleEnCours="Confirmation…"
        secondaire={false}
      >
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
      </TiroirAction>
      <TiroirAction
        libelle="Ignorer"
        titre="Ignorer ce mouvement ?"
        action={ignorerSuggestionAction}
        libelleBouton="Ignorer le mouvement"
        libelleEnCours="Ignorer…"
        danger
        question="Le mouvement proposé disparaît de la liste « À confirmer ». Il ne sera pas comptabilisé."
      >
        <input type="hidden" name="id" value={id} />
      </TiroirAction>
    </div>
  )
}
