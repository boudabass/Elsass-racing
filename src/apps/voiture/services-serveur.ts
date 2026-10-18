// Services serveur de Voiture (tâche 3.2, brief section 5). Même structure que Budget : chaque fonction
// publique passe par exigerAcces("voiture", niveau). Les fonctions « …Dans(ctx, …) » font le travail sans
// garde : elles servent aux vérifications de bus et aux scripts, jamais à un composant.
//
// Voiture n'écoute encore aucun événement (lot 3). Elle émet ses propres événements, dont les charges
// utiles sont validées par charges.ts. Aucun écran dans cette tâche (3.3). Les gabarits sont dans le code.

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { type FicheSource, rattacherDepuisSource, rattacherFichier } from "@/core/fichiers/fichiers-serveur"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { chargeEmplacementModifie, chargeFicheModifiee, chargeLogoPose, chargePapierExpireBientot, cleRappelPapier } from "./charges"
import { gabarit } from "./gabarits"
import { ErreurVoiture, refus } from "./erreurs"
import {
  CHAMPS_REGLAGE,
  emplacementsDepuisGabarit,
  peutRecevoirOccupation,
  preremplir,
  statutEmplacement,
  statutPapier,
  validerValeurs,
  verifierTransitionOccupation,
  type StatutOccupation,
  type ValeursReglage,
} from "./regles"

export { ErreurVoiture }

// --- Accès ----------------------------------------------------------------------------------

export async function accesVoiture(requis: Niveau): Promise<{ ctx: ContexteTeam; niveau: Niveau }> {
  const { session, team, membership, niveau } = await exigerAcces("voiture", requis)
  const ctx = { teamId: team.id, userId: session.userId, membership: { id: membership.id, role: membership.role } }
  return { ctx, niveau }
}

type Tx = Parameters<Parameters<typeof executerPourTeam>[2]>[0]

const TYPES_VEHICULE = ["course", "reco", "assistance", "remorque"] as const
const TYPES_PAPIER = ["passeport_technique", "fiche_homologation", "carte_grise", "assurance", "controle_technique", "autre"] as const
const VUES = ["droite", "gauche", "avant", "arriere", "dessus", "hors_plan"] as const
const CONDITIONS = ["sec", "humide", "mixte", "neige"] as const
const REVETEMENTS = ["asphalte", "terre", "mixte"] as const

const texte = (max: number) => z.string().trim().max(max).nullable().optional()
const entier = z.number().int().min(0).nullable().optional()
const jourCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ.")

// Les dates sans heure sont en minuit UTC (colonnes @db.Date).
function versJour(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`)
}

function versJourOuNull(jour: string | null | undefined): Date | null {
  return jour ? versJour(jour) : null
}

function jourDe(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

// --- Schémas d'entrée -----------------------------------------------------------------------

const schemaVehicule = z
  .object({
    nom: z.string().trim().min(1, "Donnez un nom au véhicule.").max(60),
    type: z.enum(TYPES_VEHICULE),
    // Sans gabarit (« Aucun gabarit ») : pas d'emplacement, la fiche reste à compléter.
    gabaritCle: z.string().min(1).nullable().optional(),
  })
  .strict()
export type EntreeVehicule = z.input<typeof schemaVehicule>

const schemaFiche = z
  .object({
    marque: texte(80),
    modele: texte(80),
    version: texte(80),
    annee: z.number().int().min(1900).max(2100).nullable().optional(),
    cylindreeCm3: entier,
    puissanceCh: entier,
    poidsKg: entier,
    couleur: texte(40),
    immatriculation: texte(20),
    numeroSerie: texte(40),
    groupe: texte(40),
    classe: texte(40),
    discipline: texte(40),
    acheteLe: jourCivil.nullable().optional(),
  })
  .strict()
export type EntreeFiche = z.input<typeof schemaFiche>

const schemaPapier = z
  .object({
    type: z.enum(TYPES_PAPIER),
    libelle: texte(120),
    numero: texte(60),
    delivreLe: jourCivil.nullable().optional(),
    valableJusquAu: jourCivil.nullable().optional(),
    documentFileId: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine((v) => v.type !== "autre" || (v.libelle ?? "").length > 0, {
    message: "Un papier « autre » doit avoir un libellé.",
    path: ["libelle"],
  })
export type EntreePapier = z.input<typeof schemaPapier>

const schemaForme = z.union([
  z.object({ type: z.literal("rect"), x: z.number(), y: z.number(), l: z.number().min(8), h: z.number().min(8) }).strict(),
  z.object({ type: z.literal("polygone"), points: z.array(z.tuple([z.number(), z.number()])).min(3) }).strict(),
])

const schemaEmplacement = z
  .object({
    nom: z.string().trim().min(1, "Donnez un nom à l'emplacement.").max(80),
    vue: z.enum(VUES),
    forme: schemaForme.nullable().optional(),
    symetrique: z.boolean().optional(),
    largeurCm: entier,
    hauteurCm: entier,
  })
  .strict()
export type EntreeEmplacement = z.input<typeof schemaEmplacement>

const schemaReservation = z
  .object({
    partenaireId: z.string().min(1).nullable().optional(),
    partenaireNom: z.string().trim().min(1, "Indiquez le nom du partenaire.").max(120),
    logoFileId: z.string().min(1).nullable().optional(),
    du: jourCivil.nullable().optional(),
    au: jourCivil.nullable().optional(),
  })
  .strict()
export type EntreeReservation = z.input<typeof schemaReservation>

const schemaPose = z
  .object({
    photoPoseFileId: z.string().min(1).nullable().optional(),
    poseLe: jourCivil,
  })
  .strict()
export type EntreePose = z.input<typeof schemaPose>

const schemaReglage = z
  .object({
    date: jourCivil,
    eventId: z.string().min(1).nullable().optional(),
    entryId: z.string().min(1).nullable().optional(),
    conditions: z.enum(CONDITIONS).nullable().optional(),
    revetement: z.enum(REVETEMENTS).nullable().optional(),
    valeurs: z.record(z.string(), z.union([z.number(), z.string()])),
    remarques: z.string().max(2000).optional(),
    note: z.number().int().min(1).max(5).nullable().optional(),
    setupTemplateId: z.string().min(1).nullable().optional(),
  })
  .strict()
export type EntreeReglage = z.input<typeof schemaReglage>

function valeursValides(valeurs: ValeursReglage): ValeursReglage {
  const erreurs = validerValeurs(valeurs)
  if (erreurs.length > 0) refus(erreurs.join(" "))
  return valeurs
}

// --- Véhicules ------------------------------------------------------------------------------

export async function creerVehicule(entree: EntreeVehicule): Promise<string> {
  const { ctx } = await accesVoiture("ecriture")
  return creerVehiculeDans(ctx, entree)
}

export async function creerVehiculeDans(ctx: ContexteTeam, entree: EntreeVehicule): Promise<string> {
  const donnees = schemaVehicule.parse(entree)
  const modele = donnees.gabaritCle ? gabarit(donnees.gabaritCle) : null
  if (donnees.gabaritCle && !modele) refus("Gabarit inconnu.")

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.coreVehicle.create({
      data: { id, teamId: ctx.teamId, type: donnees.type, nomCourt: donnees.nom, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
    await tx.voitureVehicle.create({
      data: { id: newId(), teamId: ctx.teamId, vehicleId: id, gabaritCle: modele?.cle ?? null, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
    if (!modele) return
    await tx.voitureSlot.createMany({
      data: emplacementsDepuisGabarit(modele).map((e) => ({
        id: newId(),
        teamId: ctx.teamId,
        vehicleId: id,
        vue: e.vue,
        nom: e.nom,
        ordre: e.ordre,
        forme: e.forme ?? undefined,
        symetrique: e.symetrique,
        statut: e.statut,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })),
    })
  })

  // Un seul événement pour la création : les emplacements arrivent avec le véhicule (sans gabarit, il n'y en a pas).
  if (modele) await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId: id }))
  return id
}

// Ligne voiture_vehicle d'un véhicule du socle. Crée la ligne à la volée (véhicules créés par Saison à
// l'engagement). Aucun événement.
export async function ficheVoiture(vehicleId: string): Promise<string> {
  const { ctx } = await accesVoiture("ecriture")
  return ficheVoitureDans(ctx, vehicleId).then((f) => f.id)
}

export async function ficheVoitureDans(ctx: ContexteTeam, vehicleId: string) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existante = await client.voitureVehicle.findFirst({ where: { teamId: ctx.teamId, vehicleId, deletedAt: null } })
  if (existante) return existante

  const vehicule = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!vehicule) refus("Véhicule introuvable.")
  try {
    return await client.voitureVehicle.create({
      data: { id: newId(), teamId: ctx.teamId, vehicleId, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
  } catch (erreur) {
    // Création concurrente : une autre requête a créé la ligne entre-temps. On la relit.
    const relue = await client.voitureVehicle.findFirst({ where: { teamId: ctx.teamId, vehicleId } })
    if (relue) return relue
    throw erreur
  }
}

export async function modifierFiche(vehicleId: string, entree: EntreeFiche): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return modifierFicheDans(ctx, vehicleId, entree)
}

export async function modifierFicheDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeFiche): Promise<void> {
  const donnees = schemaFiche.parse(entree)
  const fiche = await ficheVoitureDans(ctx, vehicleId)
  const data = {
    ...donnees,
    acheteLe: donnees.acheteLe === undefined ? undefined : donnees.acheteLe ? versJour(donnees.acheteLe) : null,
  }
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureVehicle.update({
      where: { id: fiche.id },
      data: { ...data, rev: { increment: 1 }, updatedBy: ctx.userId },
    }),
  )
  await emettre(ctx, "voiture.fiche_modifiee", chargeFicheModifiee.parse({ vehicleId }))
}

// Photo principale : core_vehicle.photo_file_id (la photo des cartes), et le fichier est rattaché à la fiche
// (app voiture, rôle photo). Aucun événement : la photo ne change pas les calculs.
export async function poserPhotoPrincipale(vehicleId: string, fileId: string | null): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  await poserPhotoPrincipaleDans(ctx, vehicleId, fileId)
}

export async function poserPhotoPrincipaleDans(ctx: ContexteTeam, vehicleId: string, fileId: string | null): Promise<void> {
  await ficheVoitureDans(ctx, vehicleId)
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.coreVehicle.update({
      where: { id: vehicleId },
      data: { photoFileId: fileId, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    if (fileId) await rattacherFichier(tx, ctx, { fileId, app: "voiture", ficheType: "vehicle", ficheId: vehicleId, role: "photo" })
  })
}

// --- Papiers --------------------------------------------------------------------------------

export async function creerPapier(vehicleId: string, entree: EntreePapier): Promise<string> {
  const { ctx } = await accesVoiture("ecriture")
  return creerPapierDans(ctx, vehicleId, entree)
}

export async function creerPapierDans(ctx: ContexteTeam, vehicleId: string, entree: EntreePapier): Promise<string> {
  const donnees = schemaPapier.parse(entree)
  await ficheVoitureDans(ctx, vehicleId)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.voiturePaper.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId,
        type: donnees.type,
        libelle: donnees.libelle ?? null,
        numero: donnees.numero ?? null,
        delivreLe: versJourOuNull(donnees.delivreLe),
        valableJusquAu: versJourOuNull(donnees.valableJusquAu),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    if (donnees.documentFileId) {
      await rattacherFichier(tx, ctx, { fileId: donnees.documentFileId, app: "voiture", ficheType: "paper", ficheId: id, role: "document" })
    }
  })
  return id
}

export async function modifierPapier(id: string, entree: EntreePapier): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return modifierPapierDans(ctx, id, entree)
}

export async function modifierPapierDans(ctx: ContexteTeam, id: string, entree: EntreePapier): Promise<void> {
  const donnees = schemaPapier.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await papierActifDans(client, ctx, id)

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.voiturePaper.update({
      where: { id },
      data: {
        type: donnees.type,
        libelle: donnees.libelle ?? null,
        numero: donnees.numero ?? null,
        delivreLe: versJourOuNull(donnees.delivreLe),
        valableJusquAu: versJourOuNull(donnees.valableJusquAu),
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    if (donnees.documentFileId) {
      await rattacherFichier(tx, ctx, { fileId: donnees.documentFileId, app: "voiture", ficheType: "paper", ficheId: id, role: "document" })
    }
  })

  // L'ancienne échéance n'est plus valable : son rappel ouvert est levé.
  const ancienneEcheance = jourDe(avant.valableJusquAu)
  if (ancienneEcheance) await leverRappelPapier(ctx, id, ancienneEcheance)
}

export async function supprimerPapier(id: string): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return supprimerPapierDans(ctx, id)
}

export async function supprimerPapierDans(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const avant = await papierActifDans(client, ctx, id)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voiturePaper.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
  const echeance = jourDe(avant.valableJusquAu)
  if (echeance) await leverRappelPapier(ctx, id, echeance)
}

async function papierActifDans(client: ReturnType<typeof prismaPourTeam>, ctx: ContexteTeam, id: string) {
  const papier = await client.voiturePaper.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!papier) refus("Papier introuvable.")
  return papier
}

async function leverRappelPapier(ctx: ContexteTeam, paperId: string, echeance: string): Promise<void> {
  await emettre(ctx, "voiture.action_levee", { cleUnicite: cleRappelPapier(paperId, echeance) })
}

// --- Emplacements ---------------------------------------------------------------------------

async function emplacementActifDans(client: ReturnType<typeof prismaPourTeam>, ctx: ContexteTeam, slotId: string) {
  const slot = await client.voitureSlot.findFirst({ where: { id: slotId, teamId: ctx.teamId, deletedAt: null } })
  if (!slot) refus("Emplacement introuvable.")
  return slot
}

async function occupationActiveDans(client: ReturnType<typeof prismaPourTeam>, slotId: string) {
  return client.voitureSlotAssignment.findFirst({ where: { slotId, deletedAt: null, statut: { not: "retire" } } })
}

// Recalcule le statut d'un emplacement à partir de son occupation active. `indisponible` est posé à la main.
async function recalculerStatutEmplacement(tx: Tx, ctx: ContexteTeam, slotId: string, indisponible: boolean): Promise<void> {
  const occupation = await tx.voitureSlotAssignment.findFirst({ where: { slotId, deletedAt: null, statut: { not: "retire" } } })
  await tx.voitureSlot.update({
    where: { id: slotId },
    data: { statut: statutEmplacement(occupation, indisponible), rev: { increment: 1 }, updatedBy: ctx.userId },
  })
}

export async function ajouterEmplacement(vehicleId: string, entree: EntreeEmplacement): Promise<string> {
  const { ctx } = await accesVoiture("ecriture")
  return ajouterEmplacementDans(ctx, vehicleId, entree)
}

export async function ajouterEmplacementDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeEmplacement): Promise<string> {
  const donnees = schemaEmplacement.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const vehicule = await client.coreVehicle.findFirst({ where: { id: vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!vehicule) refus("Véhicule introuvable.")
  const dernier = await client.voitureSlot.findFirst({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    orderBy: { ordre: "desc" },
    select: { ordre: true },
  })
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureSlot.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId,
        vue: donnees.vue,
        nom: donnees.nom,
        ordre: (dernier?.ordre ?? 0) + 1,
        forme: donnees.forme ?? undefined,
        symetrique: donnees.symetrique ?? false,
        largeurCm: donnees.largeurCm ?? null,
        hauteurCm: donnees.hauteurCm ?? null,
        statut: "libre",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId, slotId: id }))
  return id
}

// Renommer, déplacer, changer les dimensions : une seule mise à jour, un seul événement.
export async function modifierEmplacement(
  slotId: string,
  champs: { nom?: string; forme?: unknown; largeurCm?: number | null; hauteurCm?: number | null; symetrique?: boolean },
): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return modifierEmplacementDans(ctx, slotId, champs)
}

export async function modifierEmplacementDans(
  ctx: ContexteTeam,
  slotId: string,
  champs: { nom?: string; forme?: unknown; largeurCm?: number | null; hauteurCm?: number | null; symetrique?: boolean },
): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const slot = await emplacementActifDans(client, ctx, slotId)
  if (champs.symetrique === true && slot.vue !== "droite") refus("Seul un emplacement du côté droit peut être symétrique à gauche.")
  const data: Record<string, unknown> = {}
  if (champs.symetrique !== undefined) data.symetrique = champs.symetrique
  if (champs.nom !== undefined) {
    const nom = z.string().trim().min(1, "Donnez un nom à l'emplacement.").max(80).parse(champs.nom)
    data.nom = nom
  }
  if (champs.forme !== undefined) data.forme = schemaForme.nullable().parse(champs.forme) ?? null
  if (champs.largeurCm !== undefined) data.largeurCm = champs.largeurCm
  if (champs.hauteurCm !== undefined) data.hauteurCm = champs.hauteurCm
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureSlot.update({ where: { id: slotId }, data: { ...data, rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
  await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId: slot.vehicleId, slotId }))
}

export async function supprimerEmplacement(slotId: string): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return supprimerEmplacementDans(ctx, slotId)
}

export async function supprimerEmplacementDans(ctx: ContexteTeam, slotId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const slot = await emplacementActifDans(client, ctx, slotId)
  if (await occupationActiveDans(client, slotId)) refus("Retirez le logo de cet emplacement avant de le supprimer.")
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureSlot.update({ where: { id: slotId }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
  await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId: slot.vehicleId, slotId }))
}

export async function marquerIndisponible(slotId: string, indisponible: boolean): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return marquerIndisponibleDans(ctx, slotId, indisponible)
}

export async function marquerIndisponibleDans(ctx: ContexteTeam, slotId: string, indisponible: boolean): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const slot = await emplacementActifDans(client, ctx, slotId)
  if (indisponible && (await occupationActiveDans(client, slotId))) {
    refus("Retirez le logo de cet emplacement avant de le marquer indisponible.")
  }
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) => recalculerStatutEmplacement(tx, ctx, slotId, indisponible))
  await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId: slot.vehicleId, slotId }))
}

// --- Occupations (réservation, pose, retrait) ----------------------------------------------

export async function reserverEmplacement(slotId: string, entree: EntreeReservation): Promise<string> {
  const { ctx } = await accesVoiture("ecriture")
  return reserverEmplacementDans(ctx, slotId, entree)
}

// Le logo d'une réservation venue d'une convention reste celui du partenaire : il se rattache depuis la fiche
// partenaire (logoSource), même envoyé par un autre membre. Sans logoSource, la règle de saisie s'applique.
export async function reserverEmplacementDans(
  ctx: ContexteTeam,
  slotId: string,
  entree: EntreeReservation,
  options: { logoSource?: FicheSource } = {},
): Promise<string> {
  const donnees = schemaReservation.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const slot = await emplacementActifDans(client, ctx, slotId)
  if (!peutRecevoirOccupation(slot.statut)) refus("Cet emplacement est indisponible.")
  if (await occupationActiveDans(client, slotId)) refus("Cet emplacement est déjà réservé ou occupé.")
  if (donnees.logoFileId) {
    const logo = await client.coreFile.findFirst({ where: { id: donnees.logoFileId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!logo) refus("Logo introuvable dans cette team.")
  }

  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.voitureSlotAssignment.create({
      data: {
        id,
        teamId: ctx.teamId,
        slotId,
        partenaireId: donnees.partenaireId ?? null,
        partenaireNom: donnees.partenaireNom,
        logoFileId: donnees.logoFileId ?? null,
        du: versJourOuNull(donnees.du),
        au: versJourOuNull(donnees.au),
        statut: "reserve",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    if (donnees.logoFileId) {
      const cible = { app: "voiture", ficheType: "slot_assignment", ficheId: id, role: "photo" as const }
      if (options.logoSource) await rattacherDepuisSource(tx, ctx, { fileId: donnees.logoFileId, source: options.logoSource, cible })
      else await rattacherFichier(tx, ctx, { fileId: donnees.logoFileId, ...cible })
    }
    await recalculerStatutEmplacement(tx, ctx, slotId, false)
  })
  await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId: slot.vehicleId, slotId }))
  return id
}

async function occupationActiveDeId(client: ReturnType<typeof prismaPourTeam>, ctx: ContexteTeam, assignmentId: string) {
  const occupation = await client.voitureSlotAssignment.findFirst({
    where: { id: assignmentId, teamId: ctx.teamId, deletedAt: null },
    include: { slot: { select: { vehicleId: true } } },
  })
  if (!occupation) refus("Occupation introuvable.")
  return occupation
}

export async function poserLogo(assignmentId: string, entree: EntreePose): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return poserLogoDans(ctx, assignmentId, entree)
}

export async function poserLogoDans(ctx: ContexteTeam, assignmentId: string, entree: EntreePose): Promise<void> {
  const donnees = schemaPose.parse(entree)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const occupation = await occupationActiveDeId(client, ctx, assignmentId)
  const verification = verifierTransitionOccupation(occupation.statut as StatutOccupation, "pose")
  if (!verification.ok) refus(verification.message)

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.voitureSlotAssignment.update({
      where: { id: assignmentId },
      data: {
        statut: "pose",
        poseLe: versJour(donnees.poseLe),
        photoPoseFileId: donnees.photoPoseFileId ?? null,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    if (donnees.photoPoseFileId) {
      await rattacherFichier(tx, ctx, { fileId: donnees.photoPoseFileId, app: "voiture", ficheType: "slot_assignment", ficheId: assignmentId, role: "photo" })
    }
    await recalculerStatutEmplacement(tx, ctx, occupation.slotId, false)
  })

  await emettre(
    ctx,
    "voiture.logo_pose",
    chargeLogoPose.parse({
      vehicleId: occupation.slot.vehicleId,
      slotId: occupation.slotId,
      assignmentId,
      partenaireId: occupation.partenaireId,
      poseLe: donnees.poseLe,
      photoFileId: donnees.photoPoseFileId ?? null,
    }),
  )
  await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId: occupation.slot.vehicleId, slotId: occupation.slotId }))
}

export async function retirerLogo(assignmentId: string): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return retirerLogoDans(ctx, assignmentId)
}

export async function retirerLogoDans(ctx: ContexteTeam, assignmentId: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const occupation = await occupationActiveDeId(client, ctx, assignmentId)
  const verification = verifierTransitionOccupation(occupation.statut as StatutOccupation, "retire")
  if (!verification.ok) refus(verification.message)

  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    await tx.voitureSlotAssignment.update({
      where: { id: assignmentId },
      data: { statut: "retire", rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    await recalculerStatutEmplacement(tx, ctx, occupation.slotId, false)
  })
  await emettre(ctx, "voiture.emplacement_modifie", chargeEmplacementModifie.parse({ vehicleId: occupation.slot.vehicleId, slotId: occupation.slotId }))
}

// --- Fiches de réglage ----------------------------------------------------------------------

// Création côté serveur (vérifications). Depuis l'appareil, la création passe par la synchro (synchro-serveur.ts).
export async function creerReglageDans(ctx: ContexteTeam, vehicleId: string, entree: EntreeReglage): Promise<string> {
  const donnees = schemaReglage.parse(entree)
  const valeurs = valeursValides(donnees.valeurs)
  await ficheVoitureDans(ctx, vehicleId)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureSetup.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId,
        eventId: donnees.eventId ?? null,
        entryId: donnees.entryId ?? null,
        date: versJour(donnees.date),
        conditions: donnees.conditions ?? null,
        revetement: donnees.revetement ?? null,
        valeurs,
        remarques: donnees.remarques ?? "",
        note: donnees.note ?? null,
        setupTemplateId: donnees.setupTemplateId ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

// En contribution, on ne modifie que ses propres fiches (comme les dépenses de l'assistance dans Budget).
export async function modifierReglage(id: string, entree: EntreeReglage): Promise<void> {
  const { ctx, niveau } = await accesVoiture("contribution")
  return modifierReglageDans(ctx, id, entree, niveau)
}

export async function modifierReglageDans(ctx: ContexteTeam, id: string, entree: EntreeReglage, niveau: Niveau = "contribution"): Promise<void> {
  const donnees = schemaReglage.parse(entree)
  const valeurs = valeursValides(donnees.valeurs)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiche = await reglageActifDans(client, ctx, id)
  verifierPropriete(fiche.createdBy, ctx, niveau)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureSetup.update({
      where: { id },
      data: {
        eventId: donnees.eventId ?? null,
        entryId: donnees.entryId ?? null,
        date: versJour(donnees.date),
        conditions: donnees.conditions ?? null,
        revetement: donnees.revetement ?? null,
        valeurs,
        remarques: donnees.remarques ?? "",
        note: donnees.note ?? null,
        setupTemplateId: donnees.setupTemplateId ?? null,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    }),
  )
}

function verifierPropriete(createdBy: string | null, ctx: ContexteTeam, niveau: Niveau): void {
  if (niveau === "contribution" && createdBy !== ctx.userId) {
    refus("Vous ne pouvez modifier que vos propres fiches de réglage.")
  }
}

async function reglageActifDans(client: ReturnType<typeof prismaPourTeam>, ctx: ContexteTeam, id: string) {
  const fiche = await client.voitureSetup.findFirst({ where: { id, teamId: ctx.teamId, deletedAt: null } })
  if (!fiche) refus("Fiche de réglage introuvable.")
  return fiche
}

export async function supprimerReglage(id: string): Promise<void> {
  const { ctx } = await accesVoiture("ecriture")
  return supprimerReglageDans(ctx, id)
}

export async function supprimerReglageDans(ctx: ContexteTeam, id: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  await reglageActifDans(client, ctx, id)
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureSetup.update({ where: { id }, data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId } }),
  )
}

export async function enregistrerCommeReference(setupId: string, nom: string): Promise<string> {
  const { ctx } = await accesVoiture("ecriture")
  return enregistrerCommeReferenceDans(ctx, setupId, nom)
}

export async function enregistrerCommeReferenceDans(ctx: ContexteTeam, setupId: string, nom: string): Promise<string> {
  const libelle = z.string().trim().min(1, "Donnez un nom à la référence.").max(80).parse(nom)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const fiche = await reglageActifDans(client, ctx, setupId)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.voitureSetupTemplate.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId: fiche.vehicleId,
        nom: libelle,
        valeurs: fiche.valeurs as object,
        creeDepuisSetupId: fiche.id,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

// Champs de réglage masqués pour toute la team. Gestion seulement. Les champs inconnus sont refusés.
export async function masquerChamps(cles: string[]): Promise<void> {
  const { ctx } = await accesVoiture("gestion")
  return masquerChampsDans(ctx, cles)
}

export async function masquerChampsDans(ctx: ContexteTeam, cles: string[]): Promise<void> {
  const connus = new Set(CHAMPS_REGLAGE.map((c) => c.cle))
  const inconnu = cles.find((cle) => !connus.has(cle))
  if (inconnu) refus(`Champ inconnu : ${inconnu}.`)
  // Les essentiels restent toujours visibles : seuls les champs avancés se masquent.
  const essentiels = new Set(CHAMPS_REGLAGE.filter((c) => c.groupe === "essentiel").map((c) => c.cle))
  const essentiel = cles.find((cle) => essentiels.has(cle))
  if (essentiel) refus("Les réglages essentiels ne peuvent pas être masqués.")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const existante = await client.voitureTeamPref.findFirst({ where: { teamId: ctx.teamId }, select: { id: true } })
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    existante
      ? tx.voitureTeamPref.update({
          where: { id: existante.id },
          data: { champsReglageMasques: Array.from(new Set(cles)), rev: { increment: 1 }, updatedBy: ctx.userId },
        })
      : tx.voitureTeamPref.create({
          data: { id: newId(), teamId: ctx.teamId, champsReglageMasques: Array.from(new Set(cles)), createdBy: ctx.userId, updatedBy: ctx.userId },
        }),
  )
}

// Valeurs de départ d'une nouvelle fiche (voir regles.preremplir).
export async function valeursDeDepart(vehicleId: string, referenceId: string | null): Promise<ValeursReglage> {
  const { ctx } = await accesVoiture("contribution")
  return valeursDeDepartDans(ctx, vehicleId, referenceId)
}

export async function valeursDeDepartDans(ctx: ContexteTeam, vehicleId: string, referenceId: string | null): Promise<ValeursReglage> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const reference = referenceId
    ? await client.voitureSetupTemplate.findFirst({ where: { id: referenceId, teamId: ctx.teamId, deletedAt: null }, select: { valeurs: true } })
    : null
  const derniere = await client.voitureSetup.findFirst({
    where: { teamId: ctx.teamId, vehicleId, deletedAt: null },
    orderBy: { date: "desc" },
    select: { valeurs: true },
  })
  return preremplir((derniere?.valeurs as ValeursReglage) ?? null, (reference?.valeurs as ValeursReglage) ?? null)
}

// --- Échéances des papiers (recalcul à l'ouverture du QG) -----------------------------------

const PRIORITE_PAPIER_A_RENOUVELER = 4

const LIBELLES_PAPIER: Record<(typeof TYPES_PAPIER)[number], string> = {
  passeport_technique: "passeport technique",
  fiche_homologation: "fiche d'homologation",
  carte_grise: "carte grise",
  assurance: "assurance",
  controle_technique: "contrôle technique",
  autre: "papier",
}

function libelleTypePapier(type: (typeof TYPES_PAPIER)[number], libelle: string | null): string {
  return type === "autre" && libelle ? libelle : LIBELLES_PAPIER[type]
}

function dateCourte(jour: string): string {
  const [annee, mois, jourDuMois] = jour.split("-")
  return `${jourDuMois}/${mois}/${annee}`
}

// Recalcul de Voiture à l'ouverture du QG. Sans effet si le membre n'a pas de niveau sur Voiture.
export async function recalculerPourQg(ctx: ContexteTeam, niveau: Niveau): Promise<void> {
  if (niveau === "aucun") return
  await recalculerPapiersDans(ctx)
}

// Un papier à renouveler (30 jours ou moins) ou expiré : un événement et une action pour les responsables,
// une seule fois par papier et par échéance (un papier qui passe de « à renouveler » à « expiré » n'émet donc
// pas une deuxième fois). Un papier sans échéance n'émet rien. Le titre dit si l'échéance est à venir ou passée.
export async function recalculerPapiersDans(ctx: ContexteTeam): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const maintenant = new Date()
  const papiers = await client.voiturePaper.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, valableJusquAu: { not: null }, vehicle: { actif: true, deletedAt: null } },
    select: { id: true, vehicleId: true, type: true, libelle: true, valableJusquAu: true, vehicle: { select: { nomCourt: true } } },
  })
  const aRappeler = papiers.flatMap((papier) => {
    const statut = statutPapier(papier.valableJusquAu, maintenant)
    return statut === "a_renouveler" || statut === "expire" ? [{ ...papier, statut }] : []
  })
  if (aRappeler.length === 0) return

  const responsables = await client.coreMembership.findMany({
    where: { teamId: ctx.teamId, statut: "actif", deletedAt: null, role: "responsable" },
    select: { id: true },
  })

  for (const papier of aRappeler) {
    const echeance = jourDe(papier.valableJusquAu)
    if (!echeance) continue
    const dejaEmis = await client.coreDomainEvent.findFirst({
      where: {
        teamId: ctx.teamId,
        nom: "voiture.papier_expire_bientot",
        AND: [{ donnees: { path: ["paperId"], equals: papier.id } }, { donnees: { path: ["echeance"], equals: echeance } }],
      },
      select: { id: true },
    })
    if (dejaEmis || responsables.length === 0) continue

    const type = libelleTypePapier(papier.type, papier.libelle)
    const quand = papier.statut === "expire" ? `expiré depuis le ${dateCourte(echeance)}` : `expire le ${dateCourte(echeance)}`
    await emettre(ctx, "voiture.papier_expire_bientot", chargePapierExpireBientot.parse({ vehicleId: papier.vehicleId, paperId: papier.id, type: papier.type, echeance }))
    await emettre(ctx, "voiture.action_requise", {
      type: "papier_a_renouveler",
      cleUnicite: cleRappelPapier(papier.id, echeance),
      titre: `Renouveler ${type} : ${papier.vehicle.nomCourt}, ${quand}`,
      contexte: papier.vehicle.nomCourt,
      ficheType: "paper",
      ficheId: papier.id,
      destinataires: { memberships: responsables.map((membre) => membre.id) },
      boutons: [{ cle: "vu", libelle: "Vu" }],
      priorite: PRIORITE_PAPIER_A_RENOUVELER,
      niveauRequis: "gestion",
      cleRegroupement: "papiers_a_renouveler",
    })
  }
}
