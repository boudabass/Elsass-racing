// Lectures de Voiture (tâche 3.2, brief section 6). Toutes passent par accesVoiture("lecture") et ne
// touchent que les tables voiture_ ; l'historique du véhicule passe par la lecture partagée de Saison.

import { lireResultatsValidesParVehicule } from "@/apps/saison/lectures-partagees"
import { prismaPourTeam } from "@/lib/prisma"

import { accesVoiture, ficheVoitureDans } from "./services-serveur"
import { CHAMPS_REGLAGE, etatPapiersVehicule, statutPapier, type EtatPapiersVehicule, type ValeursReglage } from "./regles"
import type { TypeVehicule } from "./libelles"
import { gabarit } from "./gabarits"

// --- Liste des véhicules --------------------------------------------------------------------

export type VehiculeListe = {
  vehicleId: string
  nom: string
  type: TypeVehicule
  photoFileId: string | null
  groupe: string | null
  classe: string | null
  etatPapiers: EtatPapiersVehicule
}

// Tous les véhicules actifs de la team (y compris ceux créés par Saison, sans fiche Voiture encore).
export async function listerVehicules(): Promise<VehiculeListe[]> {
  const { ctx } = await accesVoiture("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const vehicules = await client.coreVehicle.findMany({
    where: { teamId: ctx.teamId, actif: true, deletedAt: null },
    select: { id: true, nomCourt: true, type: true, photoFileId: true, voitureVehicle: { select: { groupe: true, classe: true } } },
    orderBy: { nomCourt: "asc" },
  })
  const vehiculeIds = vehicules.map((v) => v.id)
  if (vehiculeIds.length === 0) return []

  const papiers = await client.voiturePaper.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, vehicleId: { in: vehiculeIds } },
    select: { vehicleId: true, valableJusquAu: true },
  })
  const maintenant = new Date()

  return vehicules.map((v) => ({
    vehicleId: v.id,
    nom: v.nomCourt,
    type: v.type,
    photoFileId: v.photoFileId,
    groupe: v.voitureVehicle?.groupe ?? null,
    classe: v.voitureVehicle?.classe ?? null,
    etatPapiers: etatPapiersVehicule(
      papiers.filter((p) => p.vehicleId === v.id),
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
    select: { id: true, nomCourt: true, type: true, photoFileId: true },
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
    etatPapiers: etatPapiersVehicule(papiers, maintenant),
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

type Client = ReturnType<typeof prismaPourTeam>

// Nom affiché d'un membre (personne du socle), par identifiant de compte. Sans personne : « Membre ».
async function nomsDesMembres(client: Client, teamId: string, userIds: string[]): Promise<Map<string, string>> {
  const membres = await client.coreMembership.findMany({
    where: { teamId, userId: { in: userIds }, deletedAt: null },
    select: { userId: true, person: { select: { prenom: true, nom: true } } },
  })
  return new Map(membres.map((m) => [m.userId, m.person ? `${m.person.prenom} ${m.person.nom}` : "Membre"]))
}

// Nom des épreuves du socle, par identifiant.
async function nomsDesEpreuves(client: Client, teamId: string, ids: string[]): Promise<Map<string, string>> {
  const epreuves = await client.coreEvent.findMany({ where: { teamId, id: { in: ids }, deletedAt: null }, select: { id: true, nom: true } })
  return new Map(epreuves.map((e) => [e.id, e.nom]))
}

const presents = (ids: Array<string | null>): string[] => ids.filter((id): id is string => id !== null)

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
  const epreuves = await nomsDesEpreuves(client, ctx.teamId, presents(fiches.map((f) => f.eventId)))
  const auteurs = await nomsDesMembres(client, ctx.teamId, presents(fiches.map((f) => f.createdBy)))
  return {
    fiches: fiches.map((f) => ({
      ...f,
      epreuve: f.eventId ? (epreuves.get(f.eventId) ?? null) : null,
      auteur: f.createdBy ? (auteurs.get(f.createdBy) ?? "Membre") : "Membre",
    })),
    references,
  }
}

export async function lireReglage(id: string) {
  const { ctx } = await accesVoiture("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiche = await client.voitureSetup.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!fiche) return null
  const valeurs = (fiche.valeurs ?? {}) as ValeursReglage
  const epreuves = await nomsDesEpreuves(client, ctx.teamId, presents([fiche.eventId]))
  const auteurs = await nomsDesMembres(client, ctx.teamId, presents([fiche.createdBy]))
  return {
    fiche,
    epreuve: fiche.eventId ? (epreuves.get(fiche.eventId) ?? null) : null,
    auteur: fiche.createdBy ? (auteurs.get(fiche.createdBy) ?? "Membre") : "Membre",
    champs: CHAMPS_REGLAGE.map((c) => ({ ...c, valeur: valeurs[c.cle] ?? null })),
  }
}
