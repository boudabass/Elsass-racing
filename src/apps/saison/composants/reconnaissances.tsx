"use client"

import { useActionState, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { enregistrerRecceAction, type Resultat } from "@/apps/saison/actions"
import { champDateHeure, positionCreneau } from "@/apps/saison/reconnaissances"
import { newId } from "@/core/ids"
import { useMoteurSynchro, useTable } from "@/core/synchro/client/react"

import { CHAMP, Champ, Message } from "./formulaires"

// Onglet Reconnaissances : règles de la reco (créneau, passages, vitesse, véhicule, plaque, consignes),
// puis les sorties. Une sortie hors créneau reste enregistrée : c'est une information.
// Les sorties se lisent et s'écrivent dans la base locale : elles fonctionnent hors ligne.

export interface SortieReco {
  id: string
  date: Date
  personnes: string[]
  speciales: string[]
  passages: number | null
  notes: string | null
}

export interface RecceEpreuve {
  id: string
  debutAutorise: Date | null
  finAutorisee: Date | null
  passagesAutorises: number | null
  vitesseMax: number | null
  vehiculeId: string | null
  vehiculeNom: string | null
  plaqueRecue: boolean
  consignes: string | null
  sessions: SortieReco[]
}

export interface DonneesReconnaissances {
  eventId: string
  peutEcrire: boolean
  recce: RecceEpreuve | null
  speciales: Array<{ id: string; numero: number; nom: string }>
  personnes: Array<{ id: string; nom: string }>
  vehicules: Array<{ id: string; nomCourt: string }>
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" })
const formatHeure = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })

const LIBELLE_POSITION = { dans: "Dans le créneau", hors: "Hors créneau", non_defini: "Pas de créneau défini" } as const

export function PanneauReconnaissances({ donnees }: { donnees: DonneesReconnaissances }) {
  const { recce, peutEcrire } = donnees

  // Sorties : celles de la base locale (synchronisée, y compris hors ligne). À défaut, celles du rendu serveur.
  const locales = useTable("saison_recce_session")
  const sortiesLocales: SortieReco[] = locales
    .filter((ligne) => ligne.recceId === recce?.id && ligne.deletedAt === null)
    .map((ligne) => ({
      id: ligne.id,
      date: new Date(`${String(ligne.date)}T00:00:00Z`),
      personnes: (ligne.personnes as string[] | undefined) ?? [],
      speciales: (ligne.speciales as string[] | undefined) ?? [],
      passages: (ligne.passages as number | null | undefined) ?? null,
      notes: (ligne.notes as string | null | undefined) ?? null,
    }))
  const sorties = recce ? (sortiesLocales.length > 0 ? sortiesLocales : recce.sessions) : []
  const nomsPersonnes = new Map(donnees.personnes.map((personne) => [personne.id, personne.nom]))
  const nomsSpeciales = new Map(donnees.speciales.map((stage) => [stage.id, `${stage.numero}. ${stage.nom}`]))

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Règles de la reconnaissance</h2>
        {peutEcrire ? (
          <FormulaireRecce donnees={donnees} />
        ) : recce ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <dt className="text-texte-discret">Créneau</dt>
            <dd>
              {recce.debutAutorise ? formatHeure.format(recce.debutAutorise) : "—"}
              {recce.finAutorisee ? ` → ${formatHeure.format(recce.finAutorisee)}` : ""}
            </dd>
            <dt className="text-texte-discret">Passages autorisés</dt>
            <dd>{recce.passagesAutorises ?? "—"}</dd>
            <dt className="text-texte-discret">Vitesse maximale</dt>
            <dd>{recce.vitesseMax !== null ? `${recce.vitesseMax} km/h` : "—"}</dd>
            <dt className="text-texte-discret">Véhicule de reco</dt>
            <dd>{recce.vehiculeNom ?? "—"}</dd>
            <dt className="text-texte-discret">Plaque reçue</dt>
            <dd>{recce.plaqueRecue ? "Oui" : "Non"}</dd>
            <dt className="text-texte-discret">Consignes</dt>
            <dd className="whitespace-pre-line">{recce.consignes ?? "—"}</dd>
          </dl>
        ) : (
          <p className="text-texte-discret">Aucune reconnaissance définie pour cette épreuve.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Sorties</h2>
        {recce && sorties.length === 0 && <p className="text-sm text-texte-discret">Aucune sortie saisie.</p>}
        {recce && sorties.length > 0 && (
          <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
            {sorties.map((session) => {
              const jour = session.date.toISOString().slice(0, 10)
              const position = positionCreneau(recce.debutAutorise, recce.finAutorisee, jour)
              const personnes = session.personnes.map((id) => nomsPersonnes.get(id) ?? "Membre")
              const speciales = session.speciales.map((id) => nomsSpeciales.get(id) ?? "Spéciale")
              return (
                <li key={session.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                  <p className="font-medium">
                    {formatJour.format(session.date)} ·{" "}
                    <span className={position === "hors" ? "text-etat-orange" : "text-texte-discret"}>{LIBELLE_POSITION[position]}</span>
                  </p>
                  <p>Présents : {personnes.length > 0 ? personnes.join(", ") : "non renseignés"}</p>
                  <p>Spéciales reconnues : {speciales.length > 0 ? speciales.join(", ") : "aucune"}</p>
                  {session.passages !== null && <p>Passages : {session.passages}</p>}
                  {session.notes && <p className="whitespace-pre-line text-texte-discret">{session.notes}</p>}
                </li>
              )
            })}
          </ul>
        )}
        {peutEcrire && recce && <FormulaireSortie donnees={donnees} recceId={recce.id} />}
        {peutEcrire && !recce && <p className="text-sm text-texte-discret">Définis d'abord les règles de la reconnaissance pour ajouter une sortie.</p>}
      </section>
    </div>
  )
}

function FormulaireRecce({ donnees }: { donnees: DonneesReconnaissances }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(enregistrerRecceAction, null)
  const recce = donnees.recce
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="eventId" value={donnees.eventId} />
      <Champ id="debutAutorise" libelle="Début du créneau autorisé">
        <Input id="debutAutorise" name="debutAutorise" type="datetime-local" defaultValue={champDateHeure(recce?.debutAutorise ?? null)} className={CHAMP} />
      </Champ>
      <Champ id="finAutorisee" libelle="Fin du créneau autorisé">
        <Input id="finAutorisee" name="finAutorisee" type="datetime-local" defaultValue={champDateHeure(recce?.finAutorisee ?? null)} className={CHAMP} />
      </Champ>
      <Champ id="passagesAutorises" libelle="Passages autorisés">
        <Input id="passagesAutorises" name="passagesAutorises" inputMode="numeric" defaultValue={recce?.passagesAutorises ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="vitesseMax" libelle="Vitesse maximale (km/h)">
        <Input id="vitesseMax" name="vitesseMax" inputMode="numeric" defaultValue={recce?.vitesseMax ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="vehiculeId" libelle="Véhicule de reconnaissance">
        <select id="vehiculeId" name="vehiculeId" defaultValue={recce?.vehiculeId ?? ""} className={CHAMP}>
          <option value="">Aucun</option>
          {donnees.vehicules.map((vehicule) => (
            <option key={vehicule.id} value={vehicule.id}>
              {vehicule.nomCourt}
            </option>
          ))}
        </select>
      </Champ>
      <label className="flex min-h-11 items-center gap-3 self-end">
        <input type="checkbox" name="plaqueRecue" defaultChecked={recce?.plaqueRecue ?? false} className="size-5" />
        <span>Plaque reçue</span>
      </label>
      <Champ id="consignes" libelle="Consignes">
        <textarea id="consignes" name="consignes" rows={3} defaultValue={recce?.consignes ?? ""} maxLength={2000} className={CHAMP} />
      </Champ>
      <div className="sm:col-span-2">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-2 sm:justify-self-start">
        Enregistrer les règles
      </Button>
    </form>
  )
}

// Sortie de reco : écrite dans la base locale, puis envoyée à la prochaine connexion. Fonctionne hors ligne.
function FormulaireSortie({ donnees, recceId }: { donnees: DonneesReconnaissances; recceId: string }) {
  const moteur = useMoteurSynchro()
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    const formulaire = evenement.currentTarget
    const saisie = new FormData(formulaire)
    const date = String(saisie.get("date") ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setResultat({ ok: false, message: "Date de la sortie attendue." })
      return
    }
    const passages = String(saisie.get("passages") ?? "").trim()
    const notes = String(saisie.get("notes") ?? "").trim()
    setEnCours(true)
    try {
      await moteur.ecrireLocal("saison_recce_session", {
        type: "creer",
        id: newId(),
        champs: {
          recceId,
          date,
          personnes: saisie.getAll("personnes").map(String),
          speciales: saisie.getAll("speciales").map(String),
          passages: passages === "" ? null : Number(passages),
          notes: notes === "" ? null : notes,
        },
      })
      formulaire.reset()
      setResultat({ ok: true, id: undefined })
    } catch {
      setResultat({ ok: false, message: "La sortie n'a pas pu être enregistrée sur cet appareil." })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-4 rounded-lg border border-bordure p-4">
      <h3 className="font-medium">Ajouter une sortie</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id="date" libelle="Date de la sortie">
          <Input id="date" name="date" type="date" required className={CHAMP} />
        </Champ>
        <Champ id="passages" libelle="Passages">
          <Input id="passages" name="passages" inputMode="numeric" className={CHAMP} />
        </Champ>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Présents</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {donnees.personnes.map((personne) => (
            <label key={personne.id} className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="personnes" value={personne.id} className="size-5" />
              <span>{personne.nom}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Spéciales reconnues</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {donnees.speciales.map((stage) => (
            <label key={stage.id} className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="speciales" value={stage.id} className="size-5" />
              <span>
                {stage.numero}. {stage.nom}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Champ id="notes" libelle="Notes">
        <textarea id="notes" name="notes" rows={3} maxLength={2000} className={CHAMP} />
      </Champ>
      {resultat &&
        (resultat.ok ? (
          <p role="status" className="text-sm text-etat-ok">
            Enregistré sur cet appareil. La sortie part à la prochaine connexion.
          </p>
        ) : (
          <p role="alert" className="text-sm text-etat-rouge">
            {resultat.message}
          </p>
        ))}
      <Button type="submit" disabled={enCours} className="min-h-11 sm:self-start">
        Ajouter la sortie
      </Button>
    </form>
  )
}
