// Lectures du Garage partagées avec les autres apps (tâche 4.5, brief §3 et §2). Ces fonctions ne font pas de garde :
// l'app appelante contrôle son propre accès. Elles ne renvoient jamais de prix. Lecture seule : rien ici n'écrit.

import type { ContexteTeam } from "@/core/contexte"
import { lireEngagementsAVenir, type EngagementAVenir } from "@/apps/saison/lectures-partagees"
import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"

import {
  dureesEffectives,
  etatPiece,
  etatPneus,
  indiceFiabilite,
  zoneDeEtat,
  type DureesVie,
  type IndiceFiabilite,
  type ModeUsure,
  type OrganeIndice,
  type SaisieEtat,
  type Seuils,
  type Usure,
  type Zone,
} from "./regles"
import { estimationApresEpreuve, totalPrevus, compterZones, type DecompteZones, type EstimationApres } from "./plan"
import { SELECTION_SAISIE, versSaisies } from "./services-serveur"

// État actuel d'un organe, avec ce qu'il faut pour le projeter (durées, usure, dernière saisie, seuils).
export type OrganeEtat = {
  id: string
  nom: string
  position: string | null
  critique: boolean
  pneus: boolean
  mode: ModeUsure
  seuils: Seuils
  etat: number | null
  zone: Zone
  pieceMontee: boolean
  durees: DureesVie | null
  usure: Usure | null
  saisie: SaisieEtat | null
}

export type AtelierEtats = {
  vehicleId: string
  // Ordre de l'atelier (celui du type d'organe).
  organes: OrganeEtat[]
  indice: IndiceFiabilite
}

type Client = ReturnType<typeof prismaPourTeam>

// État de tous les organes d'une voiture, comme l'atelier les calcule. Null si la voiture n'existe pas dans la team.
export async function lireEtatsAtelier(ctx: ContexteTeam, vehicleId: string): Promise<AtelierEtats | null> {
  const client: Client = prismaPourTeam(ctx.teamId, ctx.userId)
  const vehicule = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!vehicule) return null

  const organes = await client.garageVehicleComponent.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    include: {
      componentType: true,
      mounts: { where: { deposeeLe: null, deletedAt: null }, include: { part: true }, take: 1 },
      tyreSets: { where: { deletedAt: null } },
    },
    orderBy: { componentType: { ordre: "asc" } },
  })

  const piecesMontees = organes.flatMap((organe) => organe.mounts.map((montage) => montage.part.id))
  const saisies = versSaisies(
    piecesMontees.length === 0
      ? []
      : await client.garagePartEtat.findMany({ where: { teamId: ctx.teamId, partId: { in: piecesMontees }, deletedAt: null }, select: SELECTION_SAISIE }),
  )

  const indices: OrganeIndice[] = []
  const lignes: OrganeEtat[] = organes.map((organe) => {
    const critique = organe.componentType.critique
    const seuils = { orange: organe.seuilOrangePct, rouge: organe.seuilRougePct }
    const base = {
      id: organe.id,
      nom: organe.componentType.nom,
      position: organe.position,
      critique,
      mode: organe.modeUsure as ModeUsure,
      seuils,
    }

    if (organe.componentType.cle === "pneus") {
      // Organe Pneus : état du train monté, hors indice (correction C). Pas d'estimation : usure saisie à la main.
      const train = organe.tyreSets[0]
      const etat = etatPneus(Boolean(train), train?.usureEstimeePct ?? null)
      indices.push({ id: organe.id, critique, pieceMontee: Boolean(train), etat })
      return { ...base, pneus: true, etat, zone: zoneDeEtat(etat, seuils), pieceMontee: Boolean(train), durees: null, usure: null, saisie: null }
    }

    const piece = organe.mounts[0]?.part
    const durees = piece
      ? dureesEffectives(
          { km: piece.dureeVieKm, epreuves: piece.dureeVieEpreuves },
          { km: organe.dureeVieReferenceKm, epreuves: organe.dureeVieReferenceEpreuves },
        )
      : null
    const usure = piece ? { km: Number(piece.kmCumules), epreuves: piece.epreuvesCumulees } : null
    const saisie = piece ? (saisies.get(piece.id) ?? null) : null
    const etat = piece && durees && usure ? etatPiece(base.mode, durees, usure, saisie) : null
    indices.push({ id: organe.id, critique, pieceMontee: Boolean(piece), etat })
    return { ...base, pneus: false, etat, zone: zoneDeEtat(etat, seuils), pieceMontee: Boolean(piece), durees, usure, saisie }
  })

  return { vehicleId, organes: lignes, indice: indiceFiabilite(indices) }
}


// --- Plan avant épreuve (écran Garage, §2) ----------------------------------------------------------

// Estimation d'un organe après l'épreuve, selon ce qu'il porte : rien pour les pneus et sans pièce, sinon la règle pure.
function estimerOrgane(organe: OrganeEtat, kmPrevus: number | null): EstimationApres {
  if (organe.pneus) return { statut: "pneus" }
  if (!organe.pieceMontee) return { statut: "sans_piece" }
  if (!organe.durees || !organe.usure) return { statut: "a_renseigner" }
  return estimationApresEpreuve({
    mode: organe.mode,
    durees: organe.durees,
    usure: organe.usure,
    saisie: organe.saisie,
    seuils: organe.seuils,
    kmPrevus,
  })
}

export type LignePlan = {
  id: string
  nom: string
  position: string | null
  critique: boolean
  pneus: boolean
  etat: number | null
  zone: Zone
  apres: EstimationApres
  // Ordres non terminés de cet organe, prévus avant l'épreuve.
  ordres: OrdrePlan[]
}

export type OrdrePlan = {
  id: string
  titre: string
  statut: "prevu" | "en_cours"
  avancementPct: number
  dureeEstimeeMinutes: number | null
  // Présent au niveau écriture seulement.
  coutMainOeuvreCents: number | null
}

export type PlanAvantEpreuve = {
  vehicleId: string
  engagements: EngagementAVenir[]
  // Épreuve affichée : celle demandée si elle est engagée, sinon la prochaine. Null s'il n'y a aucun engagement à venir.
  epreuve: EngagementAVenir | null
  lignes: LignePlan[]
  // Ordres prévus pour l'épreuve sans organe.
  ordresSansOrgane: OrdrePlan[]
  maintenant: DecompteZones
  apres: DecompteZones & { sansEstimation: number }
  dureeMinutes: number
  coutCents: number | null
}

// Plan de la voiture pour une épreuve. Null si la voiture n'existe pas dans la team. Aucun bouton, aucune écriture :
// le plan constate et n'ajoute rien. Les prix ne sortent qu'avec avecPrix (niveau écriture).
export async function lirePlanAvantEpreuve(
  ctx: ContexteTeam,
  vehicleId: string,
  eventIdDemande: string | null,
  avecPrix: boolean,
): Promise<PlanAvantEpreuve | null> {
  const atelier = await lireEtatsAtelier(ctx, vehicleId)
  if (!atelier) return null
  const engagements = await lireEngagementsAVenir(ctx, vehicleId)
  const epreuve = engagements.find((engagement) => engagement.eventId === eventIdDemande) ?? engagements[0] ?? null

  const ordres = epreuve
    ? await prismaPourTeam(ctx.teamId, ctx.userId).garageWorkOrder.findMany({
        where: { teamId: ctx.teamId, vehicleId, aFaireAvantEventId: epreuve.eventId, statut: { not: "termine" }, deletedAt: null },
        select: { id: true, titre: true, statut: true, avancementPct: true, dureeEstimeeMinutes: true, coutMainOeuvreCents: true, vehicleComponentId: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    : []
  const versOrdre = (ordre: (typeof ordres)[number]): OrdrePlan => ({
    id: ordre.id,
    titre: ordre.titre,
    statut: ordre.statut === "en_cours" ? "en_cours" : "prevu",
    avancementPct: ordre.avancementPct,
    dureeEstimeeMinutes: ordre.dureeEstimeeMinutes,
    coutMainOeuvreCents: avecPrix ? ordre.coutMainOeuvreCents : null,
  })

  const lignes: LignePlan[] = atelier.organes.map((organe) => {
    const apres: EstimationApres = estimerOrgane(organe, epreuve?.kmPrevus ?? null)
    return {
      id: organe.id,
      nom: organe.nom,
      position: organe.position,
      critique: organe.critique,
      pneus: organe.pneus,
      etat: organe.etat,
      zone: organe.zone,
      apres,
      ordres: ordres.filter((ordre) => ordre.vehicleComponentId === organe.id).map(versOrdre),
    }
  })

  const ordresSansOrgane = ordres.filter((ordre) => ordre.vehicleComponentId === null).map(versOrdre)
  const estimees = lignes.flatMap((ligne) => (ligne.apres.statut === "estimee" ? [ligne.apres.zone] : []))
  const decompteApres = compterZones(estimees)
  const totaux = totalPrevus(
    ordres.map((ordre) => ({ dureeEstimeeMinutes: ordre.dureeEstimeeMinutes, coutMainOeuvreCents: ordre.coutMainOeuvreCents })),
    avecPrix,
  )

  return {
    vehicleId,
    engagements,
    epreuve,
    lignes,
    ordresSansOrgane,
    maintenant: compterZones(lignes.map((ligne) => ligne.zone)),
    apres: { ...decompteApres, sansEstimation: lignes.length - estimees.length },
    dureeMinutes: totaux.dureeMinutes,
    coutCents: totaux.coutCents,
  }
}


// Garage est-il activé pour la team ? Saison n'affiche son point à surveiller que dans ce cas (même règle que Budget).
export async function garageActivee(ctx: ContexteTeam): Promise<boolean> {
  const activation = await prismaPourTeam(ctx.teamId, ctx.userId).coreTeamApp.findFirst({
    where: { teamId: ctx.teamId, appCle: "garage", activee: true, deletedAt: null },
    select: { id: true },
  })
  return activation !== null
}

// --- Surveillance pour Saison (point à surveiller, 954 v1.4 §5) -----------------------------------

export type SurveillanceVehicule = {
  // Organes en zone rouge : à surveiller, ils ne bloquent rien.
  zonesRouges: Array<{ id: string; nom: string; position: string | null; etat: number | null }>
  fiabilite: number | null
}

// Ce que Saison affiche sur une voiture. Null si Garage est désactivé, si le membre n'y a pas accès en lecture, ou si
// l'atelier n'est pas préparé : le bloc n'apparaît pas. Lecture de l'état actuel : une réparation le fait disparaître
// sans événement de sortie.
export async function lireSurveillance(ctx: ContexteTeam, vehicleId: string): Promise<SurveillanceVehicule | null> {
  if (!(await garageActivee(ctx))) return null
  if (!aAuMoins(await niveauDe(ctx, "garage"), "lecture")) return null
  const atelier = await lireEtatsAtelier(ctx, vehicleId)
  if (!atelier || atelier.organes.length === 0) return null
  return {
    zonesRouges: atelier.organes.filter((organe) => organe.zone === "rouge").map(({ id, nom, position, etat }) => ({ id, nom, position, etat })),
    fiabilite: atelier.indice.indice,
  }
}
