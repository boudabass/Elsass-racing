// Lectures de Voiture (tâche 3.2, brief section 6). Toutes passent par accesVoiture("lecture") et ne
// touchent que les tables voiture_ ; l'historique du véhicule passe par la lecture partagée de Saison.

import { lireResultatsValidesParVehicule } from "@/apps/saison/lectures-partagees"
import { prismaPourTeam } from "@/lib/prisma"

import { accesVoiture, ficheVoitureDans } from "./services-serveur"
import { CHAMPS_REGLAGE, etatPapiers, statutPapier, type StatutPapier, type ValeursReglage } from "./regles"
import { gabarit } from "./gabarits"

// --- Liste des véhicules --------------------------------------------------------------------

export type VehiculeListe = {
  vehicleId: string
  nom: string
  type: string
  photoFileId: string | null
  groupe: string | null
  classe: string | null
  etatPapiers: StatutPapier
}

export async function listerVehicules(): Promise<VehiculeListe[]> {
  const { ctx } = await accesVoiture("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiches = await client.voitureVehicle.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, vehicle: { actif: true, deletedAt: null } },
    select: {
      vehicleId: true,
      groupe: true,
      classe: true,
      vehicle: { select: { nomCourt: true, type: true } },
    },
    orderBy: { vehicle: { nomCourt: "asc" } },
  })
  const vehiculeIds = fiches.map((f) => f.vehicleId)
  if (vehiculeIds.length === 0) return []

  const papiers = await client.voiturePaper.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, vehicleId: { in: vehiculeIds } },
    select: { vehicleId: true, valableJusquAu: true },
  })
  const photos = await client.coreAttachment.findMany({
    where: { teamId: ctx.teamId, app: "voiture", ficheType: "vehicle", role: "photo", ficheId: { in: vehiculeIds } },
    select: { ficheId: true, fileId: true },
    orderBy: { createdAt: "asc" },
  })
  const maintenant = new Date()

  return fiches.map((f) => ({
    vehicleId: f.vehicleId,
    nom: f.vehicle.nomCourt,
    type: f.vehicle.type,
    photoFileId: photos.find((p) => p.ficheId === f.vehicleId)?.fileId ?? null,
    groupe: f.groupe,
    classe: f.classe,
    etatPapiers: etatPapiers(
      papiers.filter((p) => p.vehicleId === f.vehicleId),
      maintenant,
    ),
  }))
}

// --- Fiche d'un véhicule --------------------------------------------------------------------

export async function lireVehicule(vehicleId: string) {
  const { ctx } = await accesVoiture("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiche = await ficheVoitureDans(ctx, vehicleId)
  const vehicule = await client.coreVehicle.findFirst({
    where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nomCourt: true, type: true },
  })
  const papiers = await client.voiturePaper.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    orderBy: [{ type: "asc" }, { valableJusquAu: "asc" }],
  })
  const emplacements = await client.voitureSlot.findMany({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    orderBy: [{ vue: "asc" }, { ordre: "asc" }],
    include: {
      occupations: {
        where: { deletedAt: null, statut: { not: "retire" } },
        take: 1,
      },
    },
  })
  const maintenant = new Date()

  return {
    vehicule,
    fiche,
    gabarit: fiche.gabaritCle ? (gabarit(fiche.gabaritCle) ?? null) : null,
    papiers: papiers.map((p) => ({ ...p, statut: statutPapier(p.valableJusquAu, maintenant) })),
    etatPapiers: etatPapiers(papiers, maintenant),
    emplacements,
  }
}

// --- Historique du véhicule (Saison) ---------------------------------------------------------

export async function historiqueVehicule(vehicleId: string) {
  const { ctx } = await accesVoiture("lecture")
  const epreuves = await lireResultatsValidesParVehicule(ctx, vehicleId)
  const kmTotal = epreuves.reduce((total, epreuve) => total + epreuve.kmSpeciale, 0)
  return { epreuves, kmTotal }
}

// --- Fiches de réglage ----------------------------------------------------------------------

export async function lireReglages(vehicleId: string) {
  const { ctx } = await accesVoiture("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [fiches, references] = await Promise.all([
    client.voitureSetup.findMany({
      where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
      orderBy: { date: "desc" },
      select: { id: true, date: true, eventId: true, entryId: true, note: true, conditions: true, revetement: true, createdBy: true },
    }),
    client.voitureSetupTemplate.findMany({
      where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, creeDepuisSetupId: true },
    }),
  ])
  return { fiches, references }
}

export async function lireReglage(id: string) {
  const { ctx } = await accesVoiture("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiche = await client.voitureSetup.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!fiche) return null
  const valeurs = (fiche.valeurs ?? {}) as ValeursReglage
  return {
    fiche,
    champs: CHAMPS_REGLAGE.map((c) => ({ ...c, valeur: valeurs[c.cle] ?? null })),
  }
}
