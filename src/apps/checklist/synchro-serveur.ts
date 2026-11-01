// Déclarations de synchro de Check-lists (tâche 5.6b ; docs/synchro.md, « Check-lists hors ligne »).
// Reçues hors ligne, en lecture seule : checklist_list et checklist_section. Écrites hors ligne : le statut et la coche
// d'un point (checklist_item), par la règle « controle » : l'assistance ne coche que dans une liste ouverte à elle.
// Le journal des coches (checklist_check_log) est écrit ici, par le serveur, jamais par l'appareil.
// Les points ne se créent ni ne se retirent hors ligne (brief 5.6b §1). Les notes de point passent par core_note.

import { z } from "zod"

import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { newId } from "@/core/ids"
import { RefusSynchro } from "@/core/synchro/erreurs"
import { apresPosition } from "@/core/synchro/position"
import { MODIFICATION_GARDEE } from "@/core/synchro/protocole"
import type { ClientTeam, DeclarationSynchro, EtatLigneSynchro, MetaEcriture, Tx } from "@/core/synchro/registre"
import { refusLectureSeule, socleSynchro } from "@/core/synchro/socle"

import { decideCoche, listeVisiblePour } from "./regles"
import { emettreApresChangement, levereReassignationSiPlusDePoint, recalculerListe } from "./services-serveur"

type RoleListe = Parameters<typeof listeVisiblePour>[0]

// Le message de la règle « controle » : la table le donne, le socle l'affiche tel quel.
export const RAISON_LISTE_FERMEE = "Cette liste n'est plus ouverte à l'assistance."
export const RAISON_LISTE_SUPPRIMEE = "Cette liste n'existe plus."

const STATUTS = ["a_faire", "fait", "sans_objet", "probleme"] as const

// Coche hors ligne : le statut, et l'heure de la coche sur l'appareil. cocheParId et l'appareil sont posés par le serveur.
const schemaCoche = z
  .object({
    statut: z.enum(STATUTS),
    cocheLe: z.string().datetime({ offset: true, message: "L'heure de la coche n'est pas valide." }),
  })
  .strict()

// Clause des listes qu'un membre voit, en miroir de listeVisiblePour (regles.ts) : responsable et équipage voient tout,
// l'assistance seulement les listes ouvertes à elle, les autres rien (null).
function clauseListesVisibles(role: string): { ouverteAssistance?: true } | null {
  if (role === "responsable" || role === "equipage") return {}
  if (role === "assistance") return { ouverteAssistance: true }
  return null
}

// Lecture : le niveau de lecture de Check-lists, puis les listes que la personne voit. L'auteur (contribution) ne sert
// pas ici : la visibilité d'une liste ne dépend pas de qui l'a créée.
async function clauseLecture(lecteur: ContexteTeam): Promise<{ ouverteAssistance?: true } | null> {
  const niveau = await niveauDe(lecteur, "checklist")
  if (!aAuMoins(niveau, "lecture")) return null
  return clauseListesVisibles(lecteur.membership.role)
}

const checklistListSynchro: DeclarationSynchro = {
  cle: "checklist_list",
  ficheType: "liste",
  app: "checklist",
  niveauLecture: "lecture",
  contributionPropre: false,
  filtreLecture: true,
  lectureSeule: true,
  schemaChamps: z.object({}).strict(),

  async lirePaquet(client: ClientTeam, teamId, position, limite, _auteurId, lecteur) {
    const clause = await clauseLecture(lecteur)
    if (clause === null) return []
    const lignes = await client.checklistList.findMany({
      where: { teamId, AND: [apresPosition(position), clause] },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      epreuveId: l.epreuveId,
      engagementId: l.engagementId,
      vehiculeId: l.vehiculeId,
      titre: l.titre,
      phase: l.phase,
      echeance: l.echeance ? l.echeance.toISOString().slice(0, 10) : null,
      ouverteAssistance: l.ouverteAssistance,
      avancement: l.avancement,
      zone: l.zone,
      statut: l.statut,
    }))
  },

  async trouver(tx, teamId, id) {
    const liste = await tx.checklistList.findFirst({ where: { teamId, id } })
    return liste ? { rev: liste.rev, auteurId: liste.createdBy, supprimee: liste.deletedAt !== null, contenu: {} } : null
  },

  creer: refusLectureSeule,
  modifier: refusLectureSeule,
  supprimer: refusLectureSeule,
}

const checklistSectionSynchro: DeclarationSynchro = {
  cle: "checklist_section",
  ficheType: "section",
  app: "checklist",
  niveauLecture: "lecture",
  contributionPropre: false,
  filtreLecture: true,
  lectureSeule: true,
  schemaChamps: z.object({}).strict(),

  async lirePaquet(client: ClientTeam, teamId, position, limite, _auteurId, lecteur) {
    const clause = await clauseLecture(lecteur)
    if (clause === null) return []
    const lignes = await client.checklistSection.findMany({
      where: { teamId, AND: [apresPosition(position), { liste: clause }] },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({ ...socleSynchro(l), listeId: l.listeId, titre: l.titre, ordre: l.ordre }))
  },

  async trouver(tx, teamId, id) {
    const section = await tx.checklistSection.findFirst({ where: { teamId, id } })
    return section ? { rev: section.rev, auteurId: section.createdBy, supprimee: section.deletedAt !== null, contenu: {} } : null
  },

  creer: refusLectureSeule,
  modifier: refusLectureSeule,
  supprimer: refusLectureSeule,
}

const checklistItemSynchro: DeclarationSynchro = {
  cle: "checklist_item",
  ficheType: "point",
  app: "checklist",
  niveauLecture: "lecture",
  // Au niveau contribution (l'assistance), seule la table dit si la liste est ouverte à la personne. Le contrôle vaut
  // pour la modification : une création (ajout de point) et une suppression (retrait) ne se font qu'en ligne.
  contributionPropre: true,
  regleContribution: "controle",
  filtreLecture: true,
  lectureSeule: false,
  schemaChamps: schemaCoche,

  async controleContribution(tx: Tx, ctx: ContexteTeam, id: string) {
    const point = await tx.checklistItem.findFirst({
      where: { id, teamId: ctx.teamId },
      select: { section: { select: { liste: { select: { ouverteAssistance: true, deletedAt: true } } } } },
    })
    if (!point) return null
    const liste = point.section.liste
    if (liste.deletedAt !== null) return RAISON_LISTE_SUPPRIMEE
    return listeVisiblePour(ctx.membership.role as RoleListe, liste) ? null : RAISON_LISTE_FERMEE
  },

  async lirePaquet(client: ClientTeam, teamId, position, limite, _auteurId, lecteur) {
    const clause = await clauseLecture(lecteur)
    if (clause === null) return []
    const lignes = await client.checklistItem.findMany({
      where: { teamId, AND: [apresPosition(position), { section: { liste: clause } }] },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return lignes.map((l) => ({
      ...socleSynchro(l),
      sectionId: l.sectionId,
      libelle: l.libelle,
      critique: l.critique,
      statut: l.statut,
      cocheParId: l.cocheParId,
      cocheLe: l.cocheLe ? l.cocheLe.toISOString() : null,
      ordre: l.ordre,
      ajoutePendantEpreuve: l.ajoutePendantEpreuve,
    }))
  },

  async trouver(tx, teamId, id) {
    const point = await tx.checklistItem.findFirst({ where: { teamId, id } })
    if (!point) return null
    const etat: EtatLigneSynchro = {
      rev: point.rev,
      auteurId: point.createdBy,
      supprimee: point.deletedAt !== null,
      contenu: { statut: point.statut, cocheLe: point.cocheLe ? point.cocheLe.toISOString() : null },
    }
    return etat
  },

  // Création et retrait hors ligne : refusés, avec leur raison (brief 5.6b §1).
  async creer() {
    throw new RefusSynchro("Ajouter un point se fait en ligne.")
  },

  // Une coche hors ligne. Le serveur décide par l'heure (decideCoche) : la plus récente l'emporte, la perdante reste
  // dans le journal (checklist_check_log, horsLigne = true). Une coche gagnante recalcule la liste dans la transaction ;
  // ses effets (événements, réassignation) partent après le commit, par apresApplication, comme en ligne.
  async modifier(tx: Tx, ctx: ContexteTeam, id: string, champs: Record<string, unknown>, meta?: MetaEcriture) {
    const point = await tx.checklistItem.findFirst({ where: { id, teamId: ctx.teamId }, include: { section: { include: { liste: true } } } })
    if (!point) return false
    const statut = String(champs.statut) as (typeof STATUTS)[number]
    const decision = decideCoche({ cocheStockee: point.cocheLe, cocheRecue: new Date(String(champs.cocheLe)), recuLe: new Date() })

    // Journal : chaque coche hors ligne, y compris la perdante. Écrit par le serveur, dans la même transaction.
    await tx.checklistCheckLog.create({
      data: {
        id: newId(),
        teamId: ctx.teamId,
        pointId: id,
        ancienStatut: point.statut,
        nouveauStatut: statut,
        parId: ctx.userId,
        le: decision.heure,
        appareilId: meta?.appareilId ?? null,
        horsLigne: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
    if (!decision.gagne) return MODIFICATION_GARDEE

    await tx.checklistItem.updateMany({
      where: { id, teamId: ctx.teamId },
      data: { statut, cocheParId: ctx.userId, cocheLe: decision.heure, rev: { increment: 1 }, updatedBy: ctx.userId },
    })
    const resultat = await recalculerListe(tx, ctx, point.section.listeId)
    if (meta) {
      // Même forme qu'en ligne (changerStatutPointDans) : ce qui sera émis après le commit.
      meta.effets.checklist = {
        liste: { id: resultat.liste.id, epreuveId: resultat.liste.epreuveId, echeance: resultat.liste.echeance },
        resultat: { avant: resultat.avant, apres: resultat.apres },
        changement: { ancien: point.statut, nouveau: statut, critique: point.critique, ajoute: false, pointId: id },
        personneId: point.personneId,
      }
    }
    return true
  },

  async supprimer() {
    throw new RefusSynchro("Retirer un point se fait en ligne.")
  },

  async apresApplication(ctx, _id, type, effets) {
    const suite = effets?.checklist as
      | {
          liste: { id: string; epreuveId: string; echeance: Date | null }
          resultat: Parameters<typeof emettreApresChangement>[2]
          changement: NonNullable<Parameters<typeof emettreApresChangement>[3]>
          personneId: string | null
        }
      | undefined
    if (type !== "modifier" || !suite) return
    await emettreApresChangement(ctx, suite.liste, suite.resultat, suite.changement)
    if (suite.personneId) await levereReassignationSiPlusDePoint(ctx, suite.personneId)
  },
}

export const declarationsChecklistSynchro: DeclarationSynchro[] = [checklistListSynchro, checklistSectionSynchro, checklistItemSynchro]
