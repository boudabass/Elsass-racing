"use client"

// Écran Casses (tâche 4.4, §3) : la liste des casses de la voiture, « à compléter » en tête ; la fiche (épreuve, spéciale,
// type, cause, organes touchés, pièces cassées, réparation liée) ; la création à la main. Les actions sont des formulaires.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect } from "react"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { completerFicheCasseAction, creerFicheCasseAction, ouvrirReparationCasseAction } from "../actions"
import { LIBELLES_TYPE_CASSE, TYPES_CASSE } from "../casses"
import type { DetailFicheCasse, FicheCasseListe } from "../lectures-casses-serveur"

import { ChoixVehicule } from "./atelier"

const CHEMIN = "/apps/garage/casses"

// Dates de casse : stockées à minuit UTC, affichées en UTC pour ne pas perdre le jour.
const dateCourte = (date: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(date)

export interface CassesEcranProps {
  vehicules: Array<{ id: string; nomCourt: string }>
  choisi: { id: string; nomCourt: string }
  fiches: FicheCasseListe[]
  peutEcrire: boolean
}

export function CassesEcran({ vehicules, choisi, fiches, peutEcrire }: CassesEcranProps) {
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="titre-rallye text-3xl">Casses</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin={CHEMIN} />}
        {peutEcrire && (
          <Link href={`${CHEMIN}/nouvelle?vehicule=${choisi.id}`} className={BOUTON}>
            Ajouter une casse
          </Link>
        )}
      </header>

      {fiches.length === 0 ? (
        <p className="text-texte-discret">Aucune casse enregistrée pour cette voiture.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fiches.map((fiche) => (
            <li key={fiche.id} className="rounded-lg border border-bordure p-4">
              <div className="flex flex-col gap-1">
                <Link href={`${CHEMIN}/${fiche.id}`} className={LIEN}>
                  {dateCourte(fiche.date)}
                  {fiche.epreuveNom ? ` · ${fiche.epreuveNom}` : " · hors épreuve"}
                </Link>
                <p className="text-sm">{fiche.type ? LIBELLES_TYPE_CASSE[fiche.type] : "Type non renseigné"}</p>
                {fiche.aCompleter && <p className="text-sm font-medium">À compléter</p>}
                {fiche.reparationLiee && <p className="text-sm text-texte-discret">Réparation liée</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export interface FormulaireCasseProps {
  vehicleId: string
  epreuves: Array<{ id: string; nom: string }>
}

// Création à la main : voiture et date obligatoires, épreuve et cause facultatives, type à compléter ensuite.
export function FormulaireCasse({ vehicleId, epreuves }: FormulaireCasseProps) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerFicheCasseAction, null)
  const retour = `${CHEMIN}?vehicule=${vehicleId}`

  useEffect(() => {
    if (resultat?.ok) router.push(resultat.id ? `${CHEMIN}/${resultat.id}` : retour)
  }, [resultat, retour, router])

  return (
    <FormulairePage formulaireId="casse-formulaire" annulerHref={retour} libelleBouton="Enregistrer la casse" libelleEnCours="Enregistrement…" enCours={enCours}>
      <form id="casse-formulaire" action={action} className="flex flex-col gap-5">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Date de la casse</span>
          <input name="date" type="date" required className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Épreuve (facultatif)</span>
          <select name="eventId" defaultValue="" className={CHAMP}>
            <option value="">Hors épreuve</option>
            {epreuves.map((epreuve) => (
              <option key={epreuve.id} value={epreuve.id}>
                {epreuve.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cause (facultatif)</span>
          <input name="cause" maxLength={300} className={CHAMP} />
        </label>
        <Message resultat={resultat} />
      </form>
    </FormulairePage>
  )
}

export interface FicheCasseProps {
  fiche: DetailFicheCasse
  peutEcrire: boolean
}

// La fiche : ce qui s'est passé, puis ce qui reste à compléter, puis la réparation.
export function FicheCasse({ fiche, peutEcrire }: FicheCasseProps) {
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href={`${CHEMIN}?vehicule=${fiche.vehicleId}`} className={LIEN}>
          Retour aux casses
        </Link>
        <h1 className="titre-rallye text-3xl">Casse du {dateCourte(fiche.date)}</h1>
        <p className="text-texte-discret">{fiche.epreuveNom ?? "Hors épreuve"}</p>
        {fiche.specialeNom && <p className="text-sm">Spéciale : {fiche.specialeNom}</p>}
        <p className="text-sm">Type : {fiche.type ? LIBELLES_TYPE_CASSE[fiche.type] : "non renseigné"}</p>
        {fiche.cause && <p className="text-sm">Cause : {fiche.cause}</p>}
        {fiche.aCompleter && <p className="text-sm font-medium">À compléter</p>}
      </header>

      {peutEcrire ? <FormulaireCompletion fiche={fiche} /> : <Recapitulatif fiche={fiche} />}

      <Reparation fiche={fiche} peutEcrire={peutEcrire} />
    </section>
  )
}

function Recapitulatif({ fiche }: { fiche: DetailFicheCasse }) {
  const touches = fiche.organes.filter((organe) => fiche.organesTouches.includes(organe.id))
  const cassees = fiche.piecesDisponibles.filter((piece) => fiche.piecesCassees.includes(piece.id))
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Organes touchés : {touches.length === 0 ? "aucun" : touches.map((organe) => organe.nom).join(", ")}</p>
      <p>Pièces cassées : {cassees.length === 0 ? "aucune" : cassees.map((piece) => piece.designation).join(", ")}</p>
    </div>
  )
}

function FormulaireCompletion({ fiche }: { fiche: DetailFicheCasse }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(completerFicheCasseAction, null)
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={fiche.id} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Type de casse</span>
        <select name="type" required defaultValue={fiche.type ?? ""} className={CHAMP}>
          <option value="" disabled>
            Choisir le type
          </option>
          {TYPES_CASSE.map((type) => (
            <option key={type} value={type}>
              {LIBELLES_TYPE_CASSE[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Cause (facultatif)</span>
        <input name="cause" defaultValue={fiche.cause ?? ""} maxLength={300} className={CHAMP} />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium">Organes touchés</legend>
        {fiche.organes.map((organe) => (
          <label key={organe.id} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="organe" value={organe.id} defaultChecked={fiche.organesTouches.includes(organe.id)} />
            {organe.nom}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium">Pièces cassées</legend>
        {fiche.piecesDisponibles.length === 0 ? (
          <p className="text-texte-discret">Aucune pièce n'était montée sur la voiture à la date de la casse.</p>
        ) : (
          fiche.piecesDisponibles.map((piece) => (
            <label key={piece.id} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="piece" value={piece.id} defaultChecked={fiche.piecesCassees.includes(piece.id)} />
              {piece.designation} <span className="text-texte-discret">({piece.organeNom})</span>
            </label>
          ))
        )}
        <p className="text-texte-discret">La fiche ne change pas le statut de la pièce : le remplacement ou la dépose le fait.</p>
      </fieldset>

      <button type="submit" disabled={enCours} className={BOUTON}>
        Enregistrer la fiche
      </button>
      <Message resultat={resultat} />
    </form>
  )
}

// Une seule réparation liée par fiche (954 §3) : on l'ouvre depuis un organe touché, puis on la suit dans Travaux.
function Reparation({ fiche, peutEcrire }: FicheCasseProps) {
  if (fiche.reparationWorkOrderId) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Réparation</h2>
        <Link href={`/apps/garage/travaux/${fiche.reparationWorkOrderId}`} className={BOUTON_SECONDAIRE}>
          Voir la réparation liée
        </Link>
      </div>
    )
  }
  const touches = fiche.organes.filter((organe) => fiche.organesTouches.includes(organe.id))
  if (!peutEcrire || touches.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">Réparation</h2>
      {touches.map((organe) => (
        <FormulaireReparation key={organe.id} incidentId={fiche.id} organeId={organe.id} nom={organe.nom} />
      ))}
    </div>
  )
}

function FormulaireReparation({ incidentId, organeId, nom }: { incidentId: string; organeId: string; nom: string }) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(ouvrirReparationCasseAction, null)

  useEffect(() => {
    if (resultat?.ok && resultat.id) router.push(`/apps/garage/travaux/${resultat.id}`)
  }, [resultat, router])

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={incidentId} />
      <input type="hidden" name="organeId" value={organeId} />
      <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
        Ouvrir une réparation : {nom}
      </button>
      <Message resultat={resultat} />
    </form>
  )
}
