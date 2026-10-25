// Déclarations de synchro du Garage (tâche 4.3, D1, D3, D5 ; docs/schema-garage.md, « Hors ligne de l'assistance »).
// garage_work_order : contribution par affectation (D1). L'assistance ne reçoit et ne modifie que les ordres où elle est
// affectée ; le paquet ne contient aucun prix pour elle. Hors ligne : création d'une intervention rapide sans pièce (type
// réparation, terminé, affectée à la personne du compte), statut et avancement, et rien d'autre. Un ordre terminé ne
// revient pas en cours (D3). Un ordre avec pièce se termine en ligne (D2, D5). Pas de suppression depuis l'appareil.
// garage_vehicle_component et garage_component_type : lues hors ligne seulement, pour choisir l'organe de l'intervention.

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { emettre } from "@/core/evenements/bus-serveur"
import { RefusSynchro } from "@/core/synchro/erreurs"
import { apresPosition } from "@/core/synchro/position"
import { refusLectureSeule, socleSynchro, type ClientTeam, type DeclarationSynchro, type EtatLigneSynchro, type Tx } from "@/core/synchro/registre"
import { newId } from "@/core/ids"
import { prismaPourTeam } from "@/lib/prisma"

import { chargeTravailTermine } from "./charges"
import { fautEmettreTravailTermine, schemaChampsOrdreHorsLigne, schemaCreationIntervention, schemaModificationOrdre } from "./synchro-champs"


function analyser<T>(schema: z.ZodType<T>, champs: Record<string, unknown>): T {
  const resultat = schema.safeParse(champs)
  if (!resultat.success) throw new RefusSynchro(resultat.error.issues[0]?.message ?? "Écriture invalide.")
  return resultat.data
}

// Champs de l'ordre tels que le paquet les envoie. Les prix (coût, devise, prestataire) ne sortent que hors assistance.
function contenuDe(ligne: {
  vehicleId: string
  vehicleComponentId: string | null
  type: string
  titre: string
  aFaireAvantEventId: string | null
  dureeEstimeeMinutes: number | null
  statut: string
  avancementPct: number
  priorite: string
  origine: string
  coutMainOeuvreCents: number | null
  devise: string
  prestataireContactId: string | null
}, avecPrix: boolean) {
  const base = {
    vehicleId: ligne.vehicleId,
    vehicleComponentId: ligne.vehicleComponentId,
    type: ligne.type,
    titre: ligne.titre,
    aFaireAvantEventId: ligne.aFaireAvantEventId,
    dureeEstimeeMinutes: ligne.dureeEstimeeMinutes,
    statut: ligne.statut,
    avancementPct: ligne.avancementPct,
    priorite: ligne.priorite,
    origine: ligne.origine,
  }
  return avecPrix ? { ...base, coutMainOeuvreCents: ligne.coutMainOeuvreCents, devise: ligne.devise, prestataireContactId: ligne.prestataireContactId } : base
}

// Fiche personne du compte dans la team (null si le compte n'en a pas).
async function personneDuCompte(tx: Tx, teamId: string, userId: string): Promise<string | null> {
  const personne = await tx.corePerson.findFirst({ where: { teamId, userId, deletedAt: null }, select: { id: true } })
  return personne?.id ?? null
}

async function estAffecteDans(tx: Tx, teamId: string, userId: string, workOrderId: string): Promise<boolean> {
  const personneId = await personneDuCompte(tx, teamId, userId)
  if (!personneId) return false
  const lien = await tx.garageWorkOrderPerson.findFirst({ where: { workOrderId, personId: personneId, teamId, deletedAt: null }, select: { id: true } })
  return lien !== null
}

const garageWorkOrderSynchro: DeclarationSynchro = {
  cle: "garage_work_order",
  ficheType: "ordre",
  app: "garage",
  niveauLecture: "contribution",
  contributionPropre: true,
  regleContribution: "affectation",
  lectureSeule: false,
  schemaChamps: schemaChampsOrdreHorsLigne,

  // Règle « affectation » : le compte est affecté à l’ordre visé (D1). La table répond ; le contrôle ne lit pas la base ailleurs.
  affecte: (tx: Tx, teamId: string, userId: string, id: string) => estAffecteDans(tx, teamId, userId, id),

  // Le paquet du niveau contribution (auteurId renseigné) ne contient que les ordres où le compte est affecté, sans prix.
  // Hors assistance (auteurId nul), la lecture est complète, prix compris.
  async lirePaquet(client: ClientTeam, teamId, position, limite, auteurId) {
    let filtre = {}
    if (auteurId) {
      const personne = await client.corePerson.findFirst({ where: { teamId, userId: auteurId, deletedAt: null }, select: { id: true } })
      if (!personne) return []
      const personneId = personne.id
      filtre = { persons: { some: { personId: personneId, teamId, deletedAt: null } } }
    }
    const lignes = await client.garageWorkOrder.findMany({
      where: { teamId, ...filtre, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({ ...socleSynchro(l), ...contenuDe(l, auteurId === null) }))
  },

  async trouver(tx: Tx, teamId, id): Promise<EtatLigneSynchro | null> {
    const ligne = await tx.garageWorkOrder.findFirst({ where: { id, teamId } })
    if (!ligne) return null
    return { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: contenuDe(ligne, false) }
  },

  // Intervention rapide hors ligne : un ordre terminé, sans pièce, affecté à la personne du compte (même transaction).
  async creer(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = analyser(schemaCreationIntervention, champs)
    const vehicule = await tx.coreVehicle.findFirst({ where: { id: donnees.vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!vehicule) throw new RefusSynchro("Véhicule introuvable dans cette team.")
    const organe = await tx.garageVehicleComponent.findFirst({ where: { id: donnees.vehicleComponentId, teamId: ctx.teamId, deletedAt: null }, select: { vehicleId: true } })
    if (!organe || organe.vehicleId !== donnees.vehicleId) throw new RefusSynchro("Cet organe n'est pas sur ce véhicule.")
    const personneId = await personneDuCompte(tx, ctx.teamId, ctx.userId)
    if (!personneId) throw new RefusSynchro("Ton compte n'a pas de fiche personne dans la team : le responsable doit la créer.")

    await tx.garageWorkOrder.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId: donnees.vehicleId,
        type: "reparation",
        titre: donnees.titre,
        vehicleComponentId: donnees.vehicleComponentId,
        priorite: "normale",
        statut: "termine",
        avancementPct: 100,
        origine: "saisie",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    await tx.garageWorkOrderPerson.create({
      data: { id: newId(), teamId: ctx.teamId, workOrderId: id, personId: personneId, createdBy: ctx.userId, updatedBy: ctx.userId },
    })
  },

  // Statut et avancement seulement. Un ordre terminé ne revient pas en cours (D3). Un ordre avec pièce se termine en ligne (D2).
  async modifier(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = analyser(schemaModificationOrdre, champs)
    const ordre = await tx.garageWorkOrder.findFirst({
      where: { id, teamId: ctx.teamId, deletedAt: null },
      select: { statut: true, type: true, vehicleComponentId: true },
    })
    if (!ordre) return false
    if (ordre.statut === "termine") throw new RefusSynchro("Cet ordre est déjà terminé : il ne revient pas en cours. Une correction se fait en ligne.")
    if (donnees.statut === "termine") {
      const pieces = await tx.garageWorkOrderPart.count({ where: { workOrderId: id, teamId: ctx.teamId, deletedAt: null } })
      if (pieces > 0) throw new RefusSynchro("Un ordre avec pièce se termine en ligne : revenez en ligne.")
      // Réparation d'un organe avec pièce montée : l'état de la pièce après réparation se saisit en ligne (954 v1.3, §4).
      if (ordre.type === "reparation" && ordre.vehicleComponentId) {
        const montee = await tx.garagePartMount.count({ where: { vehicleComponentId: ordre.vehicleComponentId, teamId: ctx.teamId, deposeeLe: null, deletedAt: null } })
        if (montee > 0) throw new RefusSynchro("Une réparation avec pièce montée se termine en ligne : l'état de la pièce se saisit en ligne.")
      }
    }
    const avancement = donnees.statut === "termine" ? 100 : donnees.avancementPct
    const resultat = await tx.garageWorkOrder.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null, statut: { not: "termine" } },
      data: {
        ...(donnees.statut !== undefined ? { statut: donnees.statut } : {}),
        ...(avancement !== undefined ? { avancementPct: avancement } : {}),
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    return resultat.count > 0
  },

  // Pas de suppression d'ordre depuis l'appareil.
  async supprimer() {
    throw new RefusSynchro("Un ordre ne se supprime qu'en ligne.")
  },

  // D7 : garage.travail_termine après la transaction, une fois, à la création terminée, à la fin hors ligne, ou à une
  // modification en conflit résolu (pousser.ts l'appelle pour toute écriture). Un ordre terminé ne se modifie plus,
  // donc la transition vers « terminé » ne se produit qu'une fois. Une ligne supprimée n'émet pas.
  async apresApplication(ctx: ContexteTeam, id, type) {
    if (type === "supprimer") return
    const ordre = await prismaPourTeam(ctx.teamId, ctx.userId).garageWorkOrder.findFirst({
      where: { id, teamId: ctx.teamId, deletedAt: null },
      select: { vehicleId: true, type: true, statut: true, deletedAt: true },
    })
    if (!fautEmettreTravailTermine(ordre) || !ordre) return
    await emettre(ctx, "garage.travail_termine", chargeTravailTermine.parse({ workOrderId: id, vehicleId: ordre.vehicleId, type: ordre.type }))
  },
}

// Tables d'organes lues hors ligne seulement : la liste de l'intervention. Lisibles par tout niveau « lecture » (l'atelier).
function lectureSeule(
  cle: string,
  ficheType: string,
  lirePaquet: DeclarationSynchro["lirePaquet"],
  trouver: DeclarationSynchro["trouver"],
): DeclarationSynchro {
  return {
    cle,
    ficheType,
    app: "garage",
    niveauLecture: "lecture",
    contributionPropre: false,
    lectureSeule: true,
    schemaChamps: z.object({}).strict(),
    lirePaquet,
    trouver,
    creer: refusLectureSeule,
    modifier: refusLectureSeule,
    supprimer: refusLectureSeule,
  }
}

const garageVehicleComponentSynchro = lectureSeule(
  "garage_vehicle_component",
  "organe",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.garageVehicleComponent.findMany({
      where: { teamId, deletedAt: null, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({ ...socleSynchro(l), vehicleId: l.vehicleId, componentTypeId: l.componentTypeId, position: l.position }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.garageVehicleComponent.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

const garageComponentTypeSynchro = lectureSeule(
  "garage_component_type",
  "type_organe",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.garageComponentType.findMany({
      where: { teamId, deletedAt: null, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({ ...socleSynchro(l), nom: l.nom, icone: l.icone, ordre: l.ordre }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.garageComponentType.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

export const declarationsGarageSynchro: DeclarationSynchro[] = [garageWorkOrderSynchro, garageVehicleComponentSynchro, garageComponentTypeSynchro]
