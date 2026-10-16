// Registre des tables synchronisables : la liste blanche (principe 2). Seules ces tables peuvent
// être lues ou écrites par la synchro. Chaque déclaration porte : la table, le schéma des champs
// modifiables, le niveau requis pour lire et pour écrire, la règle de contribution, et ses
// opérations (lecture par paquets, création, modification, suppression, journal).
//
// Les droits s'appliquent à l'app qui porte la table (ici « equipe », pour les notes de team) :
// l'assistance a la contribution, l'invité n'a rien. Pour cette tâche : core_note seulement.

import { z } from "zod"

import type { AppCle, NiveauAcces } from "@/core/catalogue"
import type { ContexteTeam } from "@/core/contexte"
import { prisma, prismaPourTeam } from "@/lib/prisma"

import type { PositionCurseur } from "./curseur"
import type { LigneSynchro } from "./protocole"

export type ClientTeam = ReturnType<typeof prismaPourTeam>
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

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
  schemaChamps: z.ZodType<Record<string, unknown>>
  // auteurId renseigné : seulement les lignes de cet auteur (périmètre « ses lignes », niveau contribution).
  lirePaquet(
    client: ClientTeam,
    teamId: string,
    position: PositionCurseur | null,
    limite: number,
    auteurId: string | null,
  ): Promise<LigneSynchro[]>
  trouver(tx: Tx, teamId: string, id: string): Promise<EtatLigneSynchro | null>
  creer(tx: Tx, ctx: ContexteTeam, id: string, champs: Record<string, unknown>): Promise<void>
  modifier(tx: Tx, ctx: ContexteTeam, id: string, champs: Record<string, unknown>): Promise<void>
  supprimer(tx: Tx, ctx: ContexteTeam, id: string): Promise<void>
}

// Après la position du curseur : updated_at strictement plus récent, ou même date et id plus grand.
function apresPosition(position: PositionCurseur | null) {
  if (!position) return {}
  const date = new Date(position.date)
  return { OR: [{ updatedAt: { gt: date } }, { updatedAt: date, id: { gt: position.id } }] }
}

const schemaNote = z
  .object({
    texte: z
      .string()
      .trim()
      .min(1, "Le texte de la note est vide.")
      .max(4000, "La note dépasse 4000 caractères."),
  })
  .strict()

const noteSynchro: DeclarationSynchro = {
  cle: "core_note",
  ficheType: "note",
  app: "equipe",
  niveauLecture: "lecture",
  contributionPropre: true,
  schemaChamps: schemaNote,

  async lirePaquet(client, teamId, position, limite, auteurId) {
    const notes = await client.coreNote.findMany({
      where: { teamId, ...(auteurId ? { createdBy: auteurId } : {}), ...apresPosition(position) },
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
    return {
      rev: note.rev,
      auteurId: note.createdBy,
      supprimee: note.deletedAt !== null,
      contenu: { texte: note.texte },
    }
  },

  async creer(tx, ctx, id, champs) {
    // Le serveur pose l'auteur, la fiche (la team) et l'app : rien de tout cela ne vient du client.
    await tx.coreNote.create({
      data: {
        id,
        teamId: ctx.teamId,
        app: "core",
        ficheType: "team",
        ficheId: ctx.teamId,
        auteurUserId: ctx.userId,
        texte: String(champs.texte),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    })
  },

  async modifier(tx, ctx, id, champs) {
    await tx.coreNote.update({
      where: { id },
      data: { texte: String(champs.texte), updatedBy: ctx.userId, rev: { increment: 1 } },
    })
  },

  async supprimer(tx, ctx, id) {
    await tx.coreNote.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: ctx.userId, rev: { increment: 1 } },
    })
  },
}

const REGISTRE: DeclarationSynchro[] = [noteSynchro]

export function declarationDe(cle: string): DeclarationSynchro | undefined {
  return REGISTRE.find((declaration) => declaration.cle === cle)
}

export function toutesLesDeclarations(): DeclarationSynchro[] {
  return REGISTRE
}
