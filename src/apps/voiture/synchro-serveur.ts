// Déclarations de synchro de Voiture (brief 3.3, section 7 ; docs/app-sdk.md, section 9).
// voiture_setup : créable et modifiable hors ligne en contribution, et seulement ses propres fiches (contribution
// propre). Une fiche ne se supprime pas depuis l'appareil : la suppression reste en ligne, au niveau écriture.
// core_vehicle et voiture_setup_template : lues hors ligne seulement (refusLectureSeule), pour afficher le
// véhicule et pré-remplir une fiche.
//
// Les règles de la saisie sont celles de creerReglageDans : valeurs bornées (validerValeurs), véhicule, épreuve
// et référence de la team. Pas d'événement sur une fiche de réglage.

import { z } from "zod"

import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { RefusSynchro } from "@/core/synchro/erreurs"
import { apresPosition } from "@/core/synchro/position"
import { refusLectureSeule, socleSynchro, type ClientTeam, type DeclarationSynchro, type EtatLigneSynchro, type Tx } from "@/core/synchro/registre"

import { validerValeurs, type ValeursReglage } from "./regles"

const DATE_CIVILE = /^\d{4}-\d{2}-\d{2}$/

// Schéma des champs modifiables (sans les colonnes du socle : le serveur pose l'auteur et la team).
const schemaReglage = z
  .object({
    vehicleId: z.string().uuid(),
    date: z.string().regex(DATE_CIVILE, "Date attendue."),
    eventId: z.string().uuid().nullable().optional(),
    entryId: z.string().uuid().nullable().optional(),
    conditions: z.enum(["sec", "humide", "mixte", "neige"]).nullable().optional(),
    revetement: z.enum(["asphalte", "terre", "mixte"]).nullable().optional(),
    valeurs: z.record(z.string(), z.union([z.number(), z.string()])).superRefine((valeurs, contexte) => {
      const erreur = validerValeurs(valeurs as ValeursReglage)[0]
      if (erreur) contexte.addIssue({ code: "custom", message: erreur })
    }),
    remarques: z.string().max(2000).optional(),
    note: z.number().int().min(1).max(5).nullable().optional(),
    setupTemplateId: z.string().uuid().nullable().optional(),
  })
  .strict()

type ChampsReglage = z.infer<typeof schemaReglage>

// Une erreur de forme devient un refus en français, comme les autres refus de la synchro.
function parserReglage(champs: Record<string, unknown>): ChampsReglage {
  const resultat = schemaReglage.safeParse(champs)
  if (!resultat.success) throw new RefusSynchro(resultat.error.issues[0]?.message ?? "Fiche de réglage invalide.")
  return resultat.data
}

const jourCivil = (date: Date) => date.toISOString().slice(0, 10)

function contenuDe(ligne: {
  vehicleId: string
  date: Date
  eventId: string | null
  entryId: string | null
  conditions: string | null
  revetement: string | null
  valeurs: unknown
  remarques: string
  note: number | null
  setupTemplateId: string | null
}) {
  return {
    vehicleId: ligne.vehicleId,
    date: jourCivil(ligne.date),
    eventId: ligne.eventId,
    entryId: ligne.entryId,
    conditions: ligne.conditions,
    revetement: ligne.revetement,
    valeurs: ligne.valeurs,
    remarques: ligne.remarques,
    note: ligne.note,
    setupTemplateId: ligne.setupTemplateId,
  }
}

// Le véhicule, l'épreuve et la référence doivent appartenir à la team (le RLS le garantit déjà, la vérification
// donne un refus lisible plutôt qu'une erreur de base).
async function verifierRattachements(tx: Tx, ctx: ContexteTeam, donnees: ChampsReglage): Promise<void> {
  const vehicule = await tx.coreVehicle.findFirst({ where: { id: donnees.vehicleId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
  if (!vehicule) throw new RefusSynchro("Véhicule introuvable dans cette team.")
  if (donnees.eventId) {
    const epreuve = await tx.coreEvent.findFirst({ where: { id: donnees.eventId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!epreuve) throw new RefusSynchro("Épreuve introuvable dans cette team.")
  }
  if (donnees.setupTemplateId) {
    const reference = await tx.voitureSetupTemplate.findFirst({ where: { id: donnees.setupTemplateId, teamId: ctx.teamId, deletedAt: null }, select: { id: true } })
    if (!reference) throw new RefusSynchro("Référence introuvable dans cette team.")
  }
}

const voitureSetupSynchro: DeclarationSynchro = {
  cle: "voiture_setup",
  ficheType: "reglage",
  app: "voiture",
  niveauLecture: "contribution",
  contributionPropre: true,
  lectureSeule: false,
  schemaChamps: schemaReglage,

  // Niveau contribution : ses fiches seulement (createdBy), comme en lecture en ligne.
  async lirePaquet(client: ClientTeam, teamId, position, limite, auteurId) {
    const lignes = await client.voitureSetup.findMany({
      where: { teamId, ...(auteurId ? { createdBy: auteurId } : {}), ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({ ...socleSynchro(l), ...contenuDe(l) }))
  },

  async trouver(tx: Tx, teamId, id): Promise<EtatLigneSynchro | null> {
    const ligne = await tx.voitureSetup.findFirst({ where: { id, teamId } })
    if (!ligne) return null
    return { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: contenuDe(ligne) }
  },

  async creer(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = parserReglage(champs)
    await verifierRattachements(tx, ctx, donnees)
    await tx.voitureSetup.create({
      data: {
        id,
        teamId: ctx.teamId,
        vehicleId: donnees.vehicleId,
        eventId: donnees.eventId ?? null,
        entryId: donnees.entryId ?? null,
        date: new Date(`${donnees.date}T00:00:00Z`),
        conditions: donnees.conditions ?? null,
        revetement: donnees.revetement ?? null,
        valeurs: donnees.valeurs,
        remarques: donnees.remarques ?? "",
        note: donnees.note ?? null,
        setupTemplateId: donnees.setupTemplateId ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  },

  // updateMany : une ligne lue plus tôt peut avoir disparu. Renvoie false si rien n'est touché.
  async modifier(tx: Tx, ctx: ContexteTeam, id, champs) {
    const donnees = parserReglage(champs)
    await verifierRattachements(tx, ctx, donnees)
    const resultat = await tx.voitureSetup.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null },
      data: {
        vehicleId: donnees.vehicleId,
        eventId: donnees.eventId ?? null,
        entryId: donnees.entryId ?? null,
        date: new Date(`${donnees.date}T00:00:00Z`),
        conditions: donnees.conditions ?? null,
        revetement: donnees.revetement ?? null,
        valeurs: donnees.valeurs,
        remarques: donnees.remarques ?? "",
        note: donnees.note ?? null,
        setupTemplateId: donnees.setupTemplateId ?? null,
        rev: { increment: 1 },
        updatedBy: ctx.userId,
      },
    })
    return resultat.count > 0
  },

  // La suppression reste en ligne, au niveau écriture : l'appareil ne supprime pas une fiche.
  async supprimer(tx: Tx, ctx: ContexteTeam, id) {
    const niveau = await niveauDe(ctx, "voiture")
    if (!aAuMoins(niveau, "ecriture")) throw new RefusSynchro("Une fiche de réglage ne se supprime qu'en ligne, par une personne qui a l'écriture.")
    const resultat = await tx.voitureSetup.updateMany({
      where: { id, teamId: ctx.teamId, deletedAt: null },
      data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    return resultat.count > 0
  },
}

// Tables de Voiture lues hors ligne seulement : véhicule et références, pour l'affichage et le pré-remplissage.
function lectureSeule(cle: string, ficheType: string, lirePaquet: DeclarationSynchro["lirePaquet"], trouver: DeclarationSynchro["trouver"]): DeclarationSynchro {
  return {
    cle,
    ficheType,
    app: "voiture",
    niveauLecture: "contribution",
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

const coreVehicleSynchro = lectureSeule(
  "core_vehicle",
  "vehicule",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.coreVehicle.findMany({ where: { teamId, ...apresPosition(position) }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limite })
    return lignes.map((l) => ({ ...socleSynchro(l), type: l.type, nomCourt: l.nomCourt, photoFileId: l.photoFileId, actif: l.actif }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.coreVehicle.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

const voitureSetupTemplateSynchro = lectureSeule(
  "voiture_setup_template",
  "reference",
  async (client: ClientTeam, teamId, position, limite) => {
    const lignes = await client.voitureSetupTemplate.findMany({
      where: { teamId, ...apresPosition(position) },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({ ...socleSynchro(l), vehicleId: l.vehicleId, nom: l.nom, valeurs: l.valeurs, creeDepuisSetupId: l.creeDepuisSetupId }))
  },
  async (tx, teamId, id) => {
    const ligne = await tx.voitureSetupTemplate.findFirst({ where: { id, teamId } })
    return ligne ? { rev: ligne.rev, auteurId: ligne.createdBy, supprimee: ligne.deletedAt !== null, contenu: {} } : null
  },
)

export const declarationsVoitureSynchro: DeclarationSynchro[] = [voitureSetupSynchro, coreVehicleSynchro, voitureSetupTemplateSynchro]
