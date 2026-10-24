// Écran des travaux (tâche 4.3, §3) : trois colonnes, en cours, prévus, terminés. Rendu côté serveur ; seul le tiroir de
// création est un composant client. Le prix et le prestataire ne sont affichés qu'au niveau écriture (cout présent).

import Link from "next/link"

import { LIEN } from "@/lib/classes-formulaire"

import type { lireChoixTravaux, OrdreTravail, TravauxVehicule } from "../lectures-serveur"
import { COLONNES_TRAVAUX, LIBELLE_PRIORITE, LIBELLE_STATUT_ORDRE, LIBELLE_TYPE_ORDRE, type StatutOrdre } from "../travaux"

import { VoitureNonSuivie } from "./atelier"
import { FormulaireOrdre } from "./formulaires-travaux"

export interface TravauxEcranProps {
  vehicules: Array<{ id: string; nomCourt: string }>
  choisi: { id: string; nomCourt: string }
  travaux: TravauxVehicule
  choix: Awaited<ReturnType<typeof lireChoixTravaux>> | null
}

const TITRES_COLONNE: Record<StatutOrdre, string> = {
  en_cours: "En cours",
  prevu: "Prévus",
  termine: "Terminés",
}

function ordres(nombre: number): string {
  return nombre === 1 ? "1 ordre" : `${nombre} ordres`
}

// Date ISO (YYYY-MM-DD) en français : 30/10/2026.
function dateCourte(iso: string): string {
  const [annee, mois, jour] = iso.split("-")
  return `${jour}/${mois}/${annee}`
}

function montant(cents: number | null, devise: string): string {
  if (cents === null) return "Coût non saisi"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).format(cents / 100)
}

function CarteOrdre({ ordre, peutEcrire }: { ordre: OrdreTravail; peutEcrire: boolean }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4">
      <h3 className="text-base font-semibold text-texte">
        <Link href={`/apps/garage/travaux/${ordre.id}`} className={LIEN}>
          {ordre.titre}
        </Link>
      </h3>
      <p className="text-sm text-texte-discret">
        {LIBELLE_TYPE_ORDRE[ordre.type]}
        {ordre.organeNom ? ` · ${ordre.organeNom}` : ""}
      </p>
      <p className="text-sm">
        Priorité {LIBELLE_PRIORITE[ordre.priorite].toLowerCase()}
        {ordre.aFaireAvant ? ` · à faire avant ${ordre.aFaireAvant.nom} (${dateCourte(ordre.aFaireAvant.date)})` : ""}
      </p>
      <p className="text-sm text-texte-discret">
        {ordre.personnes.length > 0 ? `Affecté : ${ordre.personnes.join(", ")}` : "Personne affectée : aucune"}
      </p>
      {ordre.pieces.length > 0 && <p className="text-sm text-texte-discret">Pièces : {ordre.pieces.join(", ")}</p>}
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`Avancement de ${ordre.titre}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ordre.avancementPct}
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full bg-marque" style={{ width: `${ordre.avancementPct}%` }} />
        </div>
        <span className="chiffre text-sm">{ordre.avancementPct} %</span>
      </div>
      {peutEcrire && ordre.cout !== undefined && (
        <p className="text-sm text-texte-discret">
          {montant(ordre.cout.cents, ordre.cout.devise)}
          {ordre.prestataire ? ` · prestataire : ${ordre.prestataire}` : ""}
        </p>
      )}
      <p className="text-sm font-medium">{LIBELLE_STATUT_ORDRE[ordre.statut]}</p>
    </li>
  )
}

export function TravauxEcran({ vehicules, choisi, travaux, choix }: TravauxEcranProps) {
  const total = COLONNES_TRAVAUX.reduce((somme, colonne) => somme + travaux.colonnes[colonne].length, 0)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="titre-rallye text-3xl">Travaux</h1>
          {travaux.peutEcrire &&
            choix &&
            (choix.organes.length > 0 ? <FormulaireOrdre vehicleId={choisi.id} {...choix} /> : <VoitureNonSuivie vehicleId={choisi.id} />)}
        </div>
        <nav aria-label="Voitures" className="flex flex-wrap gap-2">
          {vehicules.map((vehicule) => (
            <a
              key={vehicule.id}
              href={`?vehicule=${vehicule.id}`}
              aria-current={vehicule.id === choisi.id ? "page" : undefined}
              className={LIEN}
            >
              {vehicule.nomCourt}
            </a>
          ))}
        </nav>
        {!travaux.peutEcrire && (
          <p className="text-sm text-texte-discret">Vous ne voyez que les ordres qui vous sont affectés.</p>
        )}
      </header>

      {total === 0 && <p className="text-sm text-texte-discret">Aucun ordre de travail sur cette voiture pour l&apos;instant.</p>}

      <div className="grid gap-6 md:grid-cols-3">
        {COLONNES_TRAVAUX.map((colonne) => {
          const liste = travaux.colonnes[colonne]
          return (
            <section key={colonne} aria-labelledby={`colonne-${colonne}`} className="flex flex-col gap-3">
              <h2 id={`colonne-${colonne}`} className="text-lg font-semibold">
                {TITRES_COLONNE[colonne]} <span className="text-sm font-normal text-texte-discret">· {ordres(liste.length)}</span>
              </h2>
              {liste.length === 0 ? (
                <p className="text-sm text-texte-discret">Aucun ordre.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {liste.map((ordre) => (
                    <CarteOrdre key={ordre.id} ordre={ordre} peutEcrire={travaux.peutEcrire} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
