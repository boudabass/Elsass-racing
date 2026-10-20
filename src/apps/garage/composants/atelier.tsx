// Atelier (tâche 4.2, brief §1) : le choix de la voiture, l'indice de fiabilité, la silhouette avec un repère par organe,
// puis une carte par organe. Rendu serveur ; seul le tiroir de durée de vie est un composant client. La forme du repère
// porte la zone, le pourcentage (au bureau) et le mot portent l'état ; jamais la couleur seule.

import Link from "next/link"

import { Silhouette } from "@/components/silhouette/silhouette"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

import type { OrganeAtelier, VehiculeAtelier, VehiculeChoisi } from "../lectures-serveur"
import { libelleZone, ordreDesOrganes, phraseKmRestants, phraseManque, pourcentage } from "../mise-en-forme"
import { RAYON_CONTACT_BUREAU, RAYON_CONTACT_TELEPHONE, type PointSilhouette } from "../positions"
import type { Zone } from "../regles"

import { FormulaireDuree } from "./formulaire-duree"

// --- Choix de la voiture -------------------------------------------------------------------

export function ChoixVehicule({ vehicules, choisi }: { vehicules: VehiculeChoisi[]; choisi: string }) {
  return (
    <nav aria-label="Voiture de l'atelier" className="flex flex-wrap gap-2">
      {vehicules.map((vehicule) => {
        const actif = vehicule.id === choisi
        return (
          <Link
            key={vehicule.id}
            href={`/apps/garage?vehicule=${vehicule.id}`}
            aria-current={actif ? "page" : undefined}
            className={`cible-tactile inline-flex items-center rounded-md border px-4 ${actif ? "border-texte bg-surface-2 font-semibold" : "border-bordure"}`}
          >
            {vehicule.nomCourt}
          </Link>
        )
      })}
    </nav>
  )
}

// --- Indice de fiabilité -------------------------------------------------------------------

// La moyenne se lit en grand ; le mot (le pire organe critique renseigné, calculé par la page) se lit à côté.
export function IndiceBloc({ indice, mot, manque }: { indice: number | null; mot: string; manque: string[] }) {
  return (
    <section aria-labelledby="indice-fiabilite" className="flex flex-col gap-1">
      <h2 id="indice-fiabilite" className="text-sm text-texte-discret">
        Indice de fiabilité
      </h2>
      <p className="flex flex-wrap items-baseline gap-3">
        <span className="chiffre text-5xl font-semibold">{pourcentage(indice) ?? "—"}</span>
        <span className="text-lg">{mot}</span>
      </p>
      <p className="text-sm text-texte-discret">
        {indice === null ? phraseManque(manque) : "Moyenne des organes critiques renseignés"}
      </p>
    </section>
  )
}

// --- Silhouette et repères -----------------------------------------------------------------

// Rayon visible du repère, en unités du plan : plus gros sur téléphone, où il ne porte que sa forme.
const RAYON_REPERE_BUREAU = 12
const RAYON_REPERE_TELEPHONE = 16

// Forme de la zone : rond (vert), triangle (orange), losange (rouge), rond pointillé (à renseigner).
function formeDuRepere(zone: Zone, x: number, y: number, r: number) {
  if (zone === "orange") {
    return <polygon points={`${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}`} />
  }
  if (zone === "rouge") {
    return <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} />
  }
  if (zone === "a_renseigner") {
    return <circle cx={x} cy={y} r={r} strokeDasharray="3 2" />
  }
  return <circle cx={x} cy={y} r={r} />
}

// Un repère est un lien vers la fiche de l'organe. Le nom, le mot de la zone et le pourcentage sont dans son nom
// accessible, à toutes les tailles. Deux variantes, une seule affichée : téléphone (plus gros, sans texte) et bureau.
function RepereOrgane({ organe, point }: { organe: OrganeAtelier; point: PointSilhouette }) {
  const pct = organe.etat === null ? null : `${Math.round(organe.etat)}%`
  const libelle = `${organe.nom}, ${libelleZone(organe.zone)}${pct ? `, ${pct}` : ""}`
  const style = {
    fill: organe.zone === "rouge" ? "var(--marque)" : "var(--surface)",
    stroke: "var(--texte)",
    strokeWidth: 1.6,
  }
  return (
    <a href={`/apps/garage/organes/${organe.id}`} aria-label={libelle}>
      <g className="md:hidden">
        <circle cx={point.x} cy={point.y} r={RAYON_CONTACT_TELEPHONE} fill="transparent" />
        <g style={style}>{formeDuRepere(organe.zone, point.x, point.y, RAYON_REPERE_TELEPHONE)}</g>
      </g>
      <g className="hidden md:block">
        <circle cx={point.x} cy={point.y} r={RAYON_CONTACT_BUREAU} fill="transparent" />
        <g style={style}>{formeDuRepere(organe.zone, point.x, point.y, RAYON_REPERE_BUREAU)}</g>
        <text
          x={point.x}
          y={point.y}
          textAnchor="middle"
          dominantBaseline="central"
          className="chiffre"
          style={{ fontSize: 8, fontWeight: 600, fill: organe.zone === "rouge" ? "var(--marque-texte)" : "var(--texte)" }}
          aria-hidden="true"
        >
          {pct ?? "–"}
        </text>
      </g>
    </a>
  )
}

export function SilhouetteAtelier({ vehicule, silhouette, organes }: { vehicule: string; silhouette: NonNullable<VehiculeAtelier["silhouette"]>; organes: OrganeAtelier[] }) {
  return (
    <Silhouette viewBox={silhouette.viewBox} elements={silhouette.dessin} nomAccessible={`Silhouette de ${vehicule}, vue droite`}>
      {organes.map((organe) =>
        organe.pointSilhouette ? <RepereOrgane key={organe.id} organe={organe} point={organe.pointSilhouette} /> : null,
      )}
    </Silhouette>
  )
}

// --- Cartes des organes --------------------------------------------------------------------

// Couleur de la jauge : celle de la zone, dans les deux thèmes (jetons du socle, contraste ≥ 3:1 sur la surface).
const COULEUR_ZONE: Partial<Record<Zone, string>> = {
  vert: "var(--etat-ok)",
  orange: "var(--etat-orange)",
  rouge: "var(--etat-rouge)",
}

function Montage({ organe }: { organe: OrganeAtelier }) {
  if (organe.trainMonte) {
    return <p className="text-sm">Train monté : {organe.trainMonte.marque}</p>
  }
  if (organe.piece) {
    const reference = [organe.piece.marque, organe.piece.reference].filter(Boolean).join(" · ")
    return (
      <div className="text-sm">
        <p className="font-medium">{organe.piece.designation}</p>
        {reference && <p className="text-texte-discret">{reference}</p>}
      </div>
    )
  }
  return <p className="text-sm text-texte-discret">Aucune pièce montée</p>
}

function CarteOrgane({ organe, peutEcrire }: { organe: OrganeAtelier; peutEcrire: boolean }) {
  const pct = pourcentage(organe.etat)
  const km = phraseKmRestants(organe.kmRestants)
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {organe.nom}
            {organe.position && <span className="font-normal text-texte-discret"> · {organe.position}</span>}
          </p>
        </div>
        {pct && <span className="chiffre shrink-0 text-xl font-semibold">{pct}</span>}
      </div>

      <Montage organe={organe} />

      {organe.etat !== null && (
        <div role="img" aria-label={`État : ${pct}`} className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, organe.etat))}%`, backgroundColor: COULEUR_ZONE[organe.zone] }}
          />
        </div>
      )}

      {/* Sans pièce ni train monté, la carte dit seulement « Aucune pièce montée » : pas de zone à écrire. */}
      {(organe.piece || organe.trainMonte) && (
        <p className="text-sm">
          <span className="font-medium">{libelleZone(organe.zone)}</span>
          {km && <span className="text-texte-discret"> · {km}</span>}
        </p>
      )}

      {organe.etat === null && organe.piece && (
        <div className="flex flex-col items-start gap-2">
          {peutEcrire ? (
            <FormulaireDuree
              organeId={organe.id}
              nom={organe.nom}
              mode={organe.mode}
              dureeKm={organe.dureeReferenceKm}
              dureeEpreuves={organe.dureeReferenceEpreuves}
            />
          ) : (
            <>
              <button type="button" disabled className="cible-tactile inline-flex items-center rounded-md border border-bordure px-4 opacity-60">
                Renseigner la durée de vie
              </button>
              <p className="text-sm text-texte-discret">Seul l&apos;équipage peut renseigner la durée de vie.</p>
            </>
          )}
        </div>
      )}
    </li>
  )
}

export function CartesOrganes({ organes, niveau }: { organes: OrganeAtelier[]; niveau: Niveau }) {
  const peutEcrire = aAuMoins(niveau, "ecriture")
  if (organes.length === 0) {
    return <p className="text-texte-discret">Aucun organe suivi pour cette voiture.</p>
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {ordreDesOrganes(organes).map((organe) => (
        <CarteOrgane key={organe.id} organe={organe} peutEcrire={peutEcrire} />
      ))}
    </ul>
  )
}
