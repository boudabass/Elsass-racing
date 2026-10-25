// Lectures de Voiture partagées avec les autres apps (tâche 3.6, brief section 5). Comme celles de Saison :
// pas de garde, l'app appelante contrôle son propre accès. Ces fonctions ne renvoient que des données de
// résultat, jamais les fiches d'écriture de Voiture. Partenaires s'en sert pour choisir un emplacement.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { gabarit } from "./gabarits"
import type { ElementDessin } from "./gabarits/types"
import type { TypePapier } from "./libelles"
import { statutEmplacement, type StatutEmplacement } from "./regles"

// Silhouette d'un véhicule pour Garage (tâche 4.1, brief §1 ; vue de dessus depuis 4.3e) : la clé du gabarit et le dessin
// de la vue de dessus. Rien d'autre : aucune donnée de déco. Un véhicule sans gabarit renvoie null.
export type SilhouetteVehicule = {
  gabaritCle: string
  dessus: ElementDessin[]
}

export async function silhouetteDuVehicule(ctx: ContexteTeam, vehicleId: string): Promise<SilhouetteVehicule | null> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiche = await client.voitureVehicle.findFirst({
    where: { vehicleId, teamId: ctx.teamId, deletedAt: null },
    select: { gabaritCle: true },
  })
  if (!fiche?.gabaritCle) return null
  const modele = gabarit(fiche.gabaritCle)
  if (!modele) return null
  const dessus = modele.vuesDessinees.find((v) => v.vue === "dessus")
  return { gabaritCle: modele.cle, dessus: dessus?.dessin ?? [] }
}

export type EmplacementPourPartenaire = {
  id: string
  // Nom enregistré, côté compris (« Portière gauche ») : c'est lui que copie une contrepartie et que compare le suivi.
  nom: string
  // Nom affiché dans le choix : le même que le nom enregistré.
  libelle: string
  vehicleId: string
  vehicleNom: string
  // « libre », « réservé », « occupé » ou « indisponible » : même règle que le plan de déco.
  statut: StatutEmplacement
}

// Emplacements de tous les véhicules de la team, avec leur statut courant. Le choix d'une contrepartie
// logo les propose ; un emplacement réservé ou occupé reste choisissable, avec la mention affichée à côté.
export async function listerEmplacementsPourPartenaires(ctx: ContexteTeam): Promise<EmplacementPourPartenaire[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const emplacements = await client.voitureSlot.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, vehicle: { deletedAt: null } },
    select: {
      id: true,
      nom: true,
      vue: true,
      vehicleId: true,
      statut: true,
      vehicle: { select: { nomCourt: true } },
      occupations: { where: { deletedAt: null, statut: { not: "retire" } }, take: 1, select: { statut: true } },
    },
    orderBy: [{ vehicleId: "asc" }, { vue: "asc" }, { ordre: "asc" }],
  })
  return emplacements.map((e) => ({
    id: e.id,
    nom: e.nom,
    libelle: e.nom,
    vehicleId: e.vehicleId,
    vehicleNom: e.vehicle.nomCourt,
    statut: statutEmplacement(e.occupations[0] ?? null, e.statut === "indisponible"),
  }))
}

// Occupation d'un emplacement, pour Partenaires (brief 3.8, §4) : la pose d'un logo et sa photo. Pas de garde : l'app
// appelante contrôle son propre accès. Rien d'autre que ces champs n'est rendu.
export type OccupationPourPartenaire = {
  id: string
  slotId: string
  partenaireId: string | null
  statut: string
  poseLe: string | null
  photoPoseFileId: string | null
}

export async function lireOccupationPourPartenaires(ctx: ContexteTeam, assignmentId: string): Promise<OccupationPourPartenaire | null> {
  const occupation = await prismaPourTeam(ctx.teamId, ctx.userId).voitureSlotAssignment.findFirst({
    where: { id: assignmentId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, slotId: true, partenaireId: true, statut: true, poseLe: true, photoPoseFileId: true },
  })
  if (!occupation) return null
  return {
    id: occupation.id,
    slotId: occupation.slotId,
    partenaireId: occupation.partenaireId,
    statut: occupation.statut,
    poseLe: occupation.poseLe ? occupation.poseLe.toISOString().slice(0, 10) : null,
    photoPoseFileId: occupation.photoPoseFileId,
  }
}

// Papiers des véhicules, pour le point « Papiers » de Saison (tâche 5.2b, brief §1). Lecture seule, sans garde.
// Ne rend que le type, le libellé et l'échéance : jamais le numéro ni le document.
export type PapierSituation = {
  type: TypePapier
  libelle: string | null
  valableJusquAu: Date | null
}

// Voiture est-elle activée pour la team ? Sans elle, Saison ne suit pas le point Papiers.
export async function voitureActivee(ctx: ContexteTeam): Promise<boolean> {
  const activation = await prismaPourTeam(ctx.teamId, ctx.userId).coreTeamApp.findFirst({
    where: { teamId: ctx.teamId, appCle: "voiture", activee: true, deletedAt: null },
    select: { id: true },
  })
  return activation !== null
}

// Papiers non retirés des véhicules donnés. Un véhicule sans papier apparaît avec une liste vide.
export async function lirePapiersVehicules(ctx: ContexteTeam, vehicleIds: string[]): Promise<Map<string, PapierSituation[]>> {
  const resultat = new Map<string, PapierSituation[]>()
  const uniques = Array.from(new Set(vehicleIds))
  for (const id of uniques) resultat.set(id, [])
  if (uniques.length === 0) return resultat

  const papiers = await prismaPourTeam(ctx.teamId, ctx.userId).voiturePaper.findMany({
    where: { teamId: ctx.teamId, vehicleId: { in: uniques }, deletedAt: null },
    select: { vehicleId: true, type: true, libelle: true, valableJusquAu: true },
  })
  for (const papier of papiers) {
    resultat.get(papier.vehicleId)?.push({ type: papier.type, libelle: papier.libelle, valableJusquAu: papier.valableJusquAu })
  }
  return resultat
}
