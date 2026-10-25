// Registre des tables synchronisables : la liste blanche (principe 2). Seules ces tables peuvent
// être lues ou écrites par la synchro. Chaque déclaration porte : la table, le schéma des champs
// modifiables, le niveau requis pour lire et pour écrire, la règle de contribution, et ses
// opérations (lecture par paquets, création, modification, suppression, journal).
//
// Les droits s'appliquent à l'app qui porte la table (ici « equipe », pour les notes de team) :
// l'assistance a la contribution, l'invité n'a rien. Pour cette tâche : core_note seulement.

import { z } from "zod"

import { niveauDe } from "@/core/actions/actions-serveur"
import type { AppCle, NiveauAcces } from "@/core/catalogue"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { prisma, prismaPourTeam } from "@/lib/prisma"

import type { PositionCurseur } from "./curseur"
import type { RegleContribution, VerdictEcriture } from "./contribution"
import { RefusSynchro } from "./erreurs"
import { apresPosition } from "./position"
import { clausesFichesLisibles, controleNoteSynchro } from "@/core/notes/synchro-serveur"
import { declarationsSaisonSynchro } from "@/apps/saison/synchro-serveur"
import { declarationsBudgetSynchro } from "@/apps/budget/synchro-serveur"
import { declarationsVoitureSynchro } from "@/apps/voiture/synchro-serveur"
import { declarationsGarageSynchro } from "@/apps/garage/synchro-serveur"
import type { LigneSynchro } from "./protocole"

export type ClientTeam = ReturnType<typeof prismaPourTeam>
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Champs du socle de toute ligne synchronisée, au format de la synchro (dates en ISO).
// Déclarés ici (fonctions déclarées, donc disponibles pendant le cycle registre ↔ synchro-serveur des apps).
export interface Socle {
  id: string
  rev: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  createdBy: string | null
  updatedBy: string | null
}

export function socleSynchro(ligne: Socle) {
  return {
    id: ligne.id,
    rev: ligne.rev,
    createdAt: ligne.createdAt.toISOString(),
    updatedAt: ligne.updatedAt.toISOString(),
    deletedAt: ligne.deletedAt?.toISOString() ?? null,
    createdBy: ligne.createdBy,
    updatedBy: ligne.updatedBy,
  }
}

export function refusLectureSeule(): never {
  throw new RefusSynchro("Cette donnée se lit seulement hors ligne : elle ne s'écrit pas depuis l'appareil.")
}

export interface EtatLigneSynchro {
  rev: number
  auteurId: string | null
  supprimee: boolean
  contenu: Record<string, unknown>
}

export interface DeclarationSynchro {
  cle: string
  // Type de fiche du journal des conflits (core_activity.fiche_type).
  ficheType: string
  app: AppCle
  niveauLecture: NiveauAcces
  contributionPropre: boolean
  // Règle du niveau contribution (voir contribution.ts). Absent vaut « createur » : la ligne est de son auteur.
  regleContribution?: RegleContribution
  // Pour la règle « affectation » : le membre est-il affecté à la ligne ? Absent vaut « non ».
  affecte?(tx: Tx, teamId: string, userId: string, id: string): Promise<boolean>
  // Lecture seule depuis l'appareil : reçue hors ligne, jamais écrite par la synchro.
  lectureSeule: boolean
  schemaChamps: z.ZodType<Record<string, unknown>>
  // Lignes lisibles selon leur fiche (notes de fiche, brief 5.0) : la table est tirée même sans niveau sur son app,
  // et lirePaquet filtre selon le lecteur. Absent vaut « non ».
  filtreLecture?: boolean
  // Contrôle propre à une ligne, avant la règle de la table : null si la ligne suit la règle de la table.
  controleLigne?(tx: Tx, ctx: ContexteTeam, champs: Record<string, unknown> | undefined, etat: EtatLigneSynchro | null): Promise<VerdictEcriture | null>
  // auteurId renseigné : seulement les lignes de cet auteur (périmètre « ses lignes », niveau contribution).
  // lecteur : la personne qui tire (pour les lignes lisibles selon leur fiche).
  lirePaquet(
    client: ClientTeam,
    teamId: string,
    position: PositionCurseur | null,
    limite: number,
    auteurId: string | null,
    lecteur: ContexteTeam,
  ): Promise<LigneSynchro[]>
  trouver(tx: Tx, teamId: string, id: string): Promise<EtatLigneSynchro | null>
  creer(tx: Tx, ctx: ContexteTeam, id: string, champs: Record<string, unknown>): Promise<void>
  // Renvoient false si la ligne n'existe plus (rien n'a été écrit).
  modifier(tx: Tx, ctx: ContexteTeam, id: string, champs: Record<string, unknown>): Promise<boolean>
  supprimer(tx: Tx, ctx: ContexteTeam, id: string): Promise<boolean>
  // Facultatif : après une opération appliquée (transaction validée), pour les effets qui ne vont pas
  // dans la transaction, par exemple un événement du bus. Une erreur ici est journalisée, pas renvoyée.
  apresApplication?(ctx: ContexteTeam, id: string, type: "creer" | "modifier" | "supprimer"): Promise<void>
}

// Après la position du curseur : voir position.ts.

// Texte d'une note : rogné, non vide, 4000 caractères au plus (NOTE_TAILLE_MAX, src/core/notes/regles.ts).
const schemaTexteNote = z
  .string()
  .trim()
  .min(1, "Le texte de la note est vide.")
  .max(4000, "La note dépasse 4000 caractères.")

// Note de team : texte seul. Note de fiche : texte et fiche (app, type, identifiant), créée hors ligne sur une fiche de la liste blanche.
const schemaNoteEquipe = z.object({ texte: schemaTexteNote }).strict()
const schemaNoteFiche = z
  .object({
    app: z.string().min(1).max(64),
    ficheType: z.string().min(1).max(64),
    ficheId: z.string().uuid(),
    texte: schemaTexteNote,
  })
  .strict()
const schemaNote = z.union([schemaNoteFiche, schemaNoteEquipe])

const noteSynchro: DeclarationSynchro = {
  cle: "core_note",
  ficheType: "note",
  app: "equipe",
  niveauLecture: "lecture",
  contributionPropre: true,
  // Les notes de fiche sont lisibles selon leur fiche : la table est tirée même sans niveau sur « equipe ».
  filtreLecture: true,
  lectureSeule: false,
  schemaChamps: schemaNote,

  async lirePaquet(client, teamId, position, limite, auteurId, lecteur) {
    // Notes de team : comme avant, au niveau « equipe » de la personne (et « ses lignes » au niveau contribution).
    const niveauxEquipe = await niveauDe(lecteur, "equipe")
    const equipeLisible = aAuMoins(niveauxEquipe, "lecture")
    // Notes de fiche : seulement les fiches que la personne voit (lecture sur l'app, et fiche visible : affectée pour
    // l'assistance, toutes pour l'écriture et plus). Une note d'un ordre où elle n'est pas affectée ne descend pas.
    const fiches = await clausesFichesLisibles(lecteur)

    const visibles = [
      ...(equipeLisible ? [{ app: "core", ficheType: "team", ...(auteurId ? { createdBy: auteurId } : {}) }] : []),
      ...fiches,
    ]
    if (visibles.length === 0) return []

    const notes = await client.coreNote.findMany({
      where: { teamId, AND: [apresPosition(position), { OR: visibles }] },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limite,
    })
    return notes.map((n) => ({
      id: n.id,
      rev: n.rev,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      deletedAt: n.deletedAt?.toISOString() ?? null,
      createdBy: n.createdBy,
      updatedBy: n.updatedBy,
      app: n.app,
      ficheType: n.ficheType,
      ficheId: n.ficheId,
      auteurUserId: n.auteurUserId,
      texte: n.texte,
    }))
  },

  async trouver(tx, teamId, id) {
    const note = await tx.coreNote.findFirst({ where: { teamId, id } })
    if (!note) return null
    const fiche = note.app === "core" && note.ficheType === "team" ? {} : { app: note.app, ficheType: note.ficheType, ficheId: note.ficheId }
    return {
      rev: note.rev,
      auteurId: note.createdBy,
      supprimee: note.deletedAt !== null,
      contenu: { texte: note.texte, ...fiche },
    }
  },

  // Contrôle de la fiche d'une note de fiche (liste blanche, droits, auteur seul hors ligne). null pour une note de team.
  controleLigne: (tx, ctx, champs, etat) => controleNoteSynchro(tx, ctx, champs, etat),

  async creer(tx, ctx, id, champs) {
    // Le serveur pose l'auteur et la team. Une note de team garde app = core et ficheType = team ; une note de fiche
    // porte la fiche choisie, contrôlée avant (controleLigne).
    const fiche = "app" in champs ? { app: String(champs.app), ficheType: String(champs.ficheType), ficheId: String(champs.ficheId) } : { app: "core", ficheType: "team", ficheId: ctx.teamId }
    await tx.coreNote.create({
      data: {
        id,
        teamId: ctx.teamId,
        ...fiche,
        auteurUserId: ctx.userId,
        texte: String(champs.texte),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  },

  // updateMany et non update : une ligne lue plus tôt peut avoir disparu. Renvoie false si rien n'est touché.
  async modifier(tx, ctx, id, champs) {
    const resultat = await tx.coreNote.updateMany({
      where: { id, teamId: ctx.teamId },
      data: { texte: String(champs.texte), updatedBy: ctx.userId, rev: { increment: 1 } },
    })
    return resultat.count > 0
  },

  async supprimer(tx, ctx, id) {
    const resultat = await tx.coreNote.updateMany({
      where: { id, teamId: ctx.teamId },
      data: { deletedAt: new Date(), updatedBy: ctx.userId, rev: { increment: 1 } },
    })
    return resultat.count > 0
  },
}

const REGISTRE: DeclarationSynchro[] = [noteSynchro, ...declarationsSaisonSynchro, ...declarationsBudgetSynchro, ...declarationsVoitureSynchro, ...declarationsGarageSynchro]

export function declarationDe(cle: string): DeclarationSynchro | undefined {
  return REGISTRE.find((declaration) => declaration.cle === cle)
}

export function toutesLesDeclarations(): DeclarationSynchro[] {
  return REGISTRE
}
