// Atelier (tâche 4.2, brief §1 ; vue de dessus depuis 4.3e) : le choix de la voiture, l'indice de fiabilité, la vue de
// dessus avec un repère par emplacement à côté de la liste des organes, puis une carte par organe. Rendu serveur ; seul
// le tiroir de durée de vie est un composant client. La forme du repère porte la zone, la couleur et le pourcentage le
// rendent visible, le mot porte l'état ; jamais la couleur seule.

import Link from "next/link"

import { Silhouette } from "@/components/silhouette/silhouette"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import { LIEN } from "@/lib/classes-formulaire"

import { libellePosition } from "../emplacements"
import type { OrganeAtelier, SchemaAtelier, VehiculeChoisi } from "../lectures-serveur"
import { libelleZone, ordreDesOrganes, phraseKmRestants, pourcentage, type PhraseAtelier } from "../mise-en-forme"
import { CADRE_DESSUS, RAYON_CONTACT_BUREAU, RAYON_CONTACT_TELEPHONE, type PointSilhouette } from "../positions"
import { droitPreparerAtelier, type Zone } from "../regles"

import { BoutonPreparerAtelier } from "./preparer-atelier"
import { FormulaireDuree } from "./formulaire-duree"

// --- Choix de la voiture -------------------------------------------------------------------

// Le choix garde la page courante : l'atelier ou le stock.
export function ChoixVehicule({ vehicules, choisi, chemin = "/apps/garage" }: { vehicules: VehiculeChoisi[]; choisi: string; chemin?: string }) {
  return (
    <nav aria-label="Voiture de l'atelier" className="flex flex-wrap gap-2">
      {vehicules.map((vehicule) => {
        const actif = vehicule.id === choisi
        return (
          <Link
            key={vehicule.id}
            href={`${chemin}?vehicule=${vehicule.id}`}
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

// --- Voiture non suivie --------------------------------------------------------------------

// Une voiture sans organe : pas d'indice ni de silhouette à montrer. Le bouton pose les organes par défaut.
export function AtelierNonSuivi({ vehicleId, niveau }: { vehicleId: string; niveau: Niveau }) {
  const droit = droitPreparerAtelier(niveau)
  return (
    <section aria-labelledby="atelier-non-suivi" className="flex flex-col gap-3">
      <h2 id="atelier-non-suivi" className="text-lg font-semibold">
        Le Garage ne suit pas encore cette voiture.
      </h2>
      <p className="text-sm text-texte-discret">Préparer l&apos;atelier pose les organes par défaut : moteur, boîte, embrayage, transmissions, freins, amortisseurs, pneus.</p>
      <BoutonPreparerAtelier vehicleId={vehicleId} possible={droit.possible} raison={droit.raison} />
    </section>
  )
}

// Une voiture sans gabarit : l'atelier marche sans silhouette (la liste des organes est là). Le renvoi va à la Déco, où
// l'on choisit le modèle qui pose la silhouette.
export function SansSilhouette({ vehicleId }: { vehicleId: string }) {
  return (
    <Link href={`/apps/voiture/vehicules/${vehicleId}?onglet=deco`} className={`${LIEN} text-sm`}>
      Choisis le modèle de la voiture dans la Déco pour voir la silhouette.
    </Link>
  )
}

// Intervention et Travaux : une voiture sans organe n'a rien à choisir. Le renvoi va à l'atelier, où se prépare la voiture.
export function VoitureNonSuivie({ vehicleId }: { vehicleId: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-texte-discret">Le Garage ne suit pas encore cette voiture : aucun organe à choisir.</p>
      <Link href={`/apps/garage?vehicule=${vehicleId}`} className={LIEN}>
        Préparer l&apos;atelier
      </Link>
    </div>
  )
}

// --- Indice de fiabilité -------------------------------------------------------------------

// La moyenne se lit en grand ; le mot (le pire organe critique renseigné, calculé par la page) se lit à côté.
// Sans indice, la phrase dit ce qui manque, et chaque organe nommé renvoie à sa fiche (pose de pièce, durée de vie).
export function IndiceBloc({ indice, mot, phrases }: { indice: number | null; mot: string; phrases: PhraseAtelier[] }) {
  return (
    <section aria-labelledby="indice-fiabilite" className="flex flex-col gap-1">
      <h2 id="indice-fiabilite" className="text-sm text-texte-discret">
        Indice de fiabilité
      </h2>
      <p className="flex flex-wrap items-baseline gap-3">
        <span className="chiffre text-5xl font-semibold">{pourcentage(indice) ?? "—"}</span>
        <span className="text-lg">{mot}</span>
      </p>
      {indice === null ? (
        phrases.map((phrase) => (
          <p key={phrase.debut} className="text-sm text-texte-discret">
            {phrase.debut}
            {phrase.organes.map((organe, rang) => (
              <span key={organe.id}>
                {rang > 0 && ", "}
                <Link href={`/apps/garage/organes/${organe.id}`} className="cible-tactile inline-flex items-center underline">
                  {organe.nom}
                </Link>
              </span>
            ))}
            {phrase.fin}
          </p>
        ))
      ) : (
        <p className="text-sm text-texte-discret">Moyenne des organes critiques renseignés</p>
      )}
    </section>
  )
}

// --- Silhouette et repères -----------------------------------------------------------------

// Rayon visible du repère, en unités du plan. Sur téléphone il est plus gros (la forme et le pourcentage y tiennent).
const RAYON_REPERE_BUREAU = 12
const RAYON_REPERE_TELEPHONE = 16

// Couleur du repère, par zone : le fond est le jeton de la zone, le texte a un contraste d'au moins 4,5:1 dans les deux
// thèmes. La zone se lit aussi par la forme et par le mot : la couleur seule ne porte rien.
const COULEUR_REPERE: Record<Zone, { fond: string; texte: string }> = {
  vert: { fond: "var(--etat-ok)", texte: "var(--fond)" },
  orange: { fond: "var(--etat-orange)", texte: "var(--fond)" },
  rouge: { fond: "var(--etat-rouge)", texte: "var(--etat-rouge-texte)" },
  a_renseigner: { fond: "var(--surface)", texte: "var(--texte)" },
}

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

// Le repère dessiné : zone de contact, forme de la zone à la couleur de la zone, pourcentage au centre.
function Repere({ organe, point, rayon, rayonContact, taille }: { organe: OrganeAtelier; point: PointSilhouette; rayon: number; rayonContact: number; taille: number }) {
  const pct = organe.etat === null ? null : `${Math.round(organe.etat)}%`
  const couleur = COULEUR_REPERE[organe.zone]
  return (
    <>
      <circle cx={point.x} cy={point.y} r={rayonContact} fill="transparent" />
      <g style={{ fill: couleur.fond, stroke: "var(--texte)", strokeWidth: 1.6 }}>{formeDuRepere(organe.zone, point.x, point.y, rayon)}</g>
      <text
        x={point.x}
        y={point.y}
        textAnchor="middle"
        dominantBaseline="central"
        className="chiffre"
        style={{ fontSize: taille, fontWeight: 600, fill: couleur.texte }}
        aria-hidden="true"
      >
        {pct ?? "–"}
      </text>
    </>
  )
}

// Un repère est un lien vers la fiche de l'organe. Le nom, le mot de la zone et le pourcentage sont dans son nom
// accessible. Deux variantes, une seule affichée : téléphone (repère plus gros, zone de contact de 25 unités) et bureau.
function RepereOrgane({ organe, point }: { organe: OrganeAtelier; point: PointSilhouette }) {
  const pct = organe.etat === null ? null : `${Math.round(organe.etat)}%`
  const libelle = `${organe.nom}, ${libelleZone(organe.zone)}${pct ? `, ${pct}` : ""}`
  return (
    <a href={`/apps/garage/organes/${organe.id}`} aria-label={libelle}>
      <g className="md:hidden">
        <Repere organe={organe} point={point} rayon={RAYON_REPERE_TELEPHONE} rayonContact={RAYON_CONTACT_TELEPHONE} taille={7} />
      </g>
      <g className="hidden md:block">
        <Repere organe={organe} point={point} rayon={RAYON_REPERE_BUREAU} rayonContact={RAYON_CONTACT_BUREAU} taille={8} />
      </g>
    </a>
  )
}

// La vue de dessus, nez en haut, avec un repère par emplacement. Sans gabarit : le schéma générique, même cadre.
export function SilhouetteAtelier({ vehicule, schema, organes }: { vehicule: string; schema: SchemaAtelier; organes: OrganeAtelier[] }) {
  const nomAccessible = schema.sansGabarit ? "Schéma générique de la voiture, vue de dessus" : `Silhouette de ${vehicule}, vue de dessus`
  return (
    <Silhouette viewBox={CADRE_DESSUS.viewBox} transformation={CADRE_DESSUS.transformation} elements={schema.dessin} nomAccessible={nomAccessible}>
      {organes.map((organe) =>
        organe.pointDessus ? <RepereOrgane key={organe.id} organe={organe} point={organe.pointDessus} /> : null,
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
            <Link href={`/apps/garage/organes/${organe.id}`} className="cible-tactile inline-flex items-center underline underline-offset-4">
              {organe.nom}
            </Link>
            {libellePosition(organe.position) && <span className="font-normal text-texte-discret"> · {libellePosition(organe.position)}</span>}
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
