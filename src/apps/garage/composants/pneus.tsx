"use client"

// Écran Pneus (tâche 4.4, §2) : les trains de la voiture, le monté en tête, les usés dans un filtre à part. Les actions
// (ajouter, monter, saisir l'usure) sont des formulaires du client ; la liste et la fiche restent lisibles à l'assistance.

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { creerTrainAction, monterTrainAction, saisirUsureTrainAction } from "../actions"
import { LIBELLES_STATUT_PNEUS, LIBELLES_TYPE_PNEUS, STATUTS_PNEUS, TYPES_PNEUS } from "../pneus"
import type { TrainAtelier, UsureTrain } from "../lectures-serveur"

import { ChoixVehicule } from "./atelier"

export interface PneusEcranProps {
  vehicules: Array<{ id: string; nomCourt: string }>
  choisi: { id: string; nomCourt: string }
  trains: TrainAtelier[]
  filtre: "tous" | "usés"
  // Écriture : ajouter un train, le monter, saisir l'usure. Sans elle, la liste reste en lecture.
  peutEcrire: boolean
}

// Le filtre « usés » ne montre que les trains au statut « Usé » ; la liste par défaut les cache.
export function PneusEcran({ vehicules, choisi, trains, filtre, peutEcrire }: PneusEcranProps) {
  const affiches = filtre === "usés" ? trains.filter((t) => t.statut === "use") : trains.filter((t) => t.statut !== "use")
  const cheminEcran = "/apps/garage/pneus"

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="titre-rallye text-3xl">Pneus</h1>
        {vehicules.length > 1 && <ChoixVehicule vehicules={vehicules} choisi={choisi.id} chemin={cheminEcran} />}
        <div className="flex flex-wrap gap-2">
          {peutEcrire && (
            <Link href={`${cheminEcran}/nouveau?vehicule=${choisi.id}`} className={BOUTON}>
              Ajouter un train
            </Link>
          )}
          <Link href={filtre === "usés" ? `${cheminEcran}?vehicule=${choisi.id}` : `${cheminEcran}?vehicule=${choisi.id}&filtre=usés`} className={BOUTON_SECONDAIRE}>
            {filtre === "usés" ? "Voir les trains en service" : "Voir les trains usés"}
          </Link>
        </div>
      </header>

      {affiches.length === 0 ? (
        <p className="text-texte-discret">{filtre === "usés" ? "Aucun train usé pour cette voiture." : "Aucun train pour cette voiture."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {affiches.map((train) => (
            <li key={train.id} className="rounded-lg border border-bordure p-4">
              <div className="flex flex-col gap-1">
                <p className="font-semibold">
                  {train.marque}
                  {train.modele ? ` ${train.modele}` : ""} · {train.typeLibelle}
                </p>
                <p className="text-sm text-texte-discret">
                  {train.monte ? "Monté sur la voiture" : "Non monté"} · {train.statutLibelle}
                  {train.usureEstimeePct !== null ? ` · usure estimée ${train.usureEstimeePct} %` : " · usure à renseigner"}
                </p>
                <p className="text-sm text-texte-discret">
                  {train.nombreEpreuves} épreuve(s) · {train.kmSpeciale} km de spéciale
                </p>
              </div>
              <Link href={`${cheminEcran}/${train.id}`} className={`${LIEN} mt-2 inline-block`}>
                Ouvrir le train
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export interface FormulaireTrainProps {
  vehicleId: string
  // Présents seulement au niveau écriture : sans eux, pas de prix ni de fournisseur.
  fournisseurs: Array<{ id: string; nom: string }>
}

// Ajouter un train (§2) : marque et type obligatoires ; prix et fournisseur facultatifs. Avec un prix, le fournisseur est
// obligatoire, et l'achat passe par une commande reçue (garage.piece_achetee, Budget).
export function FormulaireTrain({ vehicleId, fournisseurs }: FormulaireTrainProps) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerTrainAction, null)
  const retour = `/apps/garage/pneus?vehicule=${vehicleId}`

  useEffect(() => {
    if (resultat?.ok) router.push(retour)
  }, [resultat, retour, router])

  return (
    <FormulairePage formulaireId="train-formulaire" annulerHref={retour} libelleBouton="Ajouter le train" libelleEnCours="Enregistrement…" enCours={enCours}>
      <form id="train-formulaire" action={action} className="flex flex-col gap-5">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Marque</span>
            <input name="marque" required maxLength={100} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Type</span>
            <select name="type" required defaultValue="" className={CHAMP}>
              <option value="" disabled>
                Choisir le type
              </option>
              {TYPES_PNEUS.map((type) => (
                <option key={type} value={type}>
                  {LIBELLES_TYPE_PNEUS[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Modèle (facultatif)</span>
            <input name="modele" maxLength={100} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Gomme (facultatif)</span>
            <input name="gomme" maxLength={100} className={CHAMP} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Dimensions (facultatif)</span>
          <input name="dimensions" maxLength={50} placeholder="195/55 R15" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Acheté le (facultatif)</span>
          <input name="acheteLe" type="date" className={CHAMP} />
        </label>
        <div className="flex flex-col gap-3 rounded-lg border border-bordure p-4">
          <p className="text-sm text-texte-discret">Un prix passe par une commande reçue : le fournisseur est alors obligatoire.</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Prix, en euros (facultatif)</span>
            <input name="prixCents" inputMode="decimal" className={CHAMP} placeholder="120,00" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Fournisseur (avec un prix)</span>
            <select name="fournisseurContactId" defaultValue="" className={CHAMP}>
              <option value="">Aucun fournisseur</option>
              {fournisseurs.map((fournisseur) => (
                <option key={fournisseur.id} value={fournisseur.id}>
                  {fournisseur.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>
      <Message resultat={resultat} />
    </FormulairePage>
  )
}

export interface FicheTrainProps {
  train: TrainAtelier
  organePneusId: string | null
  usures: UsureTrain[]
  peutEcrire: boolean
}

// La fiche d'un train : monter (si ce n'est pas déjà fait), saisir l'usure et le statut, et l'historique des lignes d'usure.
export function FicheTrain({ train, organePneusId, usures, peutEcrire }: FicheTrainProps) {
  const router = useRouter()
  const [resultatMonte, actionMonte, enCoursMonte] = useActionState<Resultat | null, FormData>(monterTrainAction, null)
  const [resultatUsure, actionUsure, enCoursUsure] = useActionState<Resultat | null, FormData>(saisirUsureTrainAction, null)

  useEffect(() => {
    if (resultatMonte?.ok || resultatUsure?.ok) router.refresh()
  }, [resultatMonte, resultatUsure, router])

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">
          {train.marque}
          {train.modele ? ` ${train.modele}` : ""}
        </h1>
        <p className="text-texte-discret">
          {train.typeLibelle}
          {train.gomme ? ` · ${train.gomme}` : ""}
          {train.dimensions ? ` · ${train.dimensions}` : ""}
          {train.acheteLe ? ` · acheté le ${train.acheteLe.split("-").reverse().join("/")}` : ""}
        </p>
        <p className="text-sm">
          {train.monte ? "Monté sur la voiture" : "Non monté"} · {train.statutLibelle}
        </p>
      </header>

      {peutEcrire && !train.monte && organePneusId && (
        <form action={actionMonte} className="flex flex-col gap-2">
          <input type="hidden" name="tyreSetId" value={train.id} />
          <input type="hidden" name="vehicleComponentId" value={organePneusId} />
          <button type="submit" disabled={enCoursMonte} className={BOUTON}>
            Monter ce train
          </button>
          <p className="text-sm text-texte-discret">Le train actuellement monté est démonté. Il reste à la team, sans destination.</p>
          <Message resultat={resultatMonte} />
        </form>
      )}

      {peutEcrire && (
        <form action={actionUsure} className="flex flex-col gap-3">
          <input type="hidden" name="tyreSetId" value={train.id} />
          <h2 className="text-lg font-semibold">Usure et statut</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Usure estimée, en % (0 à 100)</span>
            <input name="usureEstimeePct" type="number" min={0} max={100} step={1} required defaultValue={train.usureEstimeePct ?? ""} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Statut</span>
            <select name="statut" defaultValue={train.statut} className={CHAMP}>
              {STATUTS_PNEUS.map((statut) => (
                <option key={statut} value={statut}>
                  {LIBELLES_STATUT_PNEUS[statut]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={enCoursUsure} className={BOUTON}>
            Enregistrer l'usure
          </button>
          <Message resultat={resultatUsure} />
        </form>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Historique d'usure</h2>
        {usures.length === 0 ? (
          <p className="text-texte-discret">Aucune épreuve ni roulage compté pour ce train.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {usures.map((usure, index) => (
              <li key={`${usure.date}-${index}`} className="text-sm">
                {usure.date.split("-").reverse().join("/")} · {usure.epreuveComptee ? "Épreuve" : "Roulage"} · {usure.kmAjoutes} km
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
