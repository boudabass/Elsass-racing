// Vues de la Prospection (brief 3.6, §2) : une ligne par partenaire en liste, une carte par partenaire en colonnes,
// et les trois widgets de la 3.5 en petites cartes. Rien ici ne modifie la base : les changements passent par les actions.

import Link from "next/link"

import { formaterMontant, type StatutPartenaire } from "../regles"
import { CLASSE_TON_RELANCE, ecartRelance } from "../affichage"

import { ChangerStatut, PastilleStatut } from "./statut"

export interface PartenairePourListe {
  id: string
  entreprise: string
  interlocuteur: string | null
  statut: StatutPartenaire
  prochaineRelance: string | null
  suiviPar: string | null
  conventionsActives: number
  apportSaisonCentimes: number
}

// Une ligne de la liste : entreprise, interlocuteur, statut, relance, suivi, apport de la saison.
export function LigneProspect({ partenaire, aujourdhui }: { partenaire: PartenairePourListe; aujourdhui: string }) {
  const relance = ecartRelance(partenaire.prochaineRelance, aujourdhui)
  return (
    <li className="flex flex-col gap-2 rounded-md border border-bordure bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Link href={`/apps/partenaires/${partenaire.id}`} className="cible-tactile inline-flex items-center font-medium underline underline-offset-4 decoration-marque decoration-2 break-words">
          {partenaire.entreprise}
        </Link>
        {partenaire.interlocuteur && <span className="text-sm text-texte-discret">{partenaire.interlocuteur}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <PastilleStatut statut={partenaire.statut} />
        {relance && <span className={CLASSE_TON_RELANCE[relance.ton]}>{relance.libelle}</span>}
        {partenaire.suiviPar && <span className="text-texte-discret">Suivi par {partenaire.suiviPar}</span>}
        {partenaire.apportSaisonCentimes > 0 && <span>Apport : {formaterMontant(partenaire.apportSaisonCentimes)}</span>}
      </div>
    </li>
  )
}

// Une carte de la vue en colonnes : la même information, plus le menu de statut (au clavier comme à la souris).
export function CarteProspect({ partenaire, aujourdhui }: { partenaire: PartenairePourListe; aujourdhui: string }) {
  const relance = ecartRelance(partenaire.prochaineRelance, aujourdhui)
  return (
    <li className="flex flex-col gap-2 rounded-md border border-bordure bg-surface p-3">
      <Link href={`/apps/partenaires/${partenaire.id}`} className="font-medium underline underline-offset-4 decoration-marque decoration-2 break-words">
        {partenaire.entreprise}
      </Link>
      {relance && <span className={`text-sm ${CLASSE_TON_RELANCE[relance.ton]}`}>{relance.libelle}</span>}
      {partenaire.suiviPar && <span className="text-sm text-texte-discret">Suivi par {partenaire.suiviPar}</span>}
      <ChangerStatut partnerId={partenaire.id} statut={partenaire.statut} compact />
    </li>
  )
}

// Trois widgets en petites cartes. Une carte à zéro reste visible, sans couleur d'alerte.
export function WidgetsProspection({
  relances,
  retards,
  actifs,
}: {
  relances: { nombre: number; premier: { entreprise: string; date: string | null } | null }
  retards: { nombre: number }
  actifs: { partenairesActifs: number; saison: string | null; apportSaisonCentimes: number }
}) {
  const carte = "flex flex-col gap-1 rounded-md border border-bordure bg-surface p-4"
  return (
    <section aria-label="Aperçu" className="grid gap-3 sm:grid-cols-3">
      <div className={carte}>
        <h2 className="text-sm text-texte-discret">Relances de la semaine</h2>
        <p className="text-2xl font-medium">{relances.nombre}</p>
        {relances.premier && <p className="text-sm text-texte-discret">Première : {relances.premier.entreprise}</p>}
      </div>
      <div className={carte}>
        <h2 className="text-sm text-texte-discret">Contreparties en retard</h2>
        <p className={`text-2xl font-medium ${retards.nombre > 0 ? "text-etat-rouge" : ""}`}>{retards.nombre}</p>
      </div>
      <div className={carte}>
        <h2 className="text-sm text-texte-discret">Partenaires actifs</h2>
        <p className="text-2xl font-medium">{actifs.partenairesActifs}</p>
        <p className="text-sm text-texte-discret">
          {actifs.saison ? `Apport ${actifs.saison} : ${formaterMontant(actifs.apportSaisonCentimes)}` : "Aucune saison en cours"}
        </p>
      </div>
    </section>
  )
}
