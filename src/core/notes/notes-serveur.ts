// Service serveur des notes et photos de fiche (brief 5.0, §2). Socle : les apps n'écrivent jamais ces tables elles-mêmes.
// Les droits viennent de la fiche : chaque fonction reçoit le ControleFiche de l'app (voir, contribuer, gerer), qui lève
// une erreur métier en français si la personne n'a pas le droit. Ce service ne décide rien seul.
// Écritures concurrentes : avecReprisePourConflit. Une photo retirée garde son fichier physique (purge plus tard).

import type { ContexteTeam } from "@/core/contexte"
import { newId } from "@/core/ids"
import { ErreurMetier } from "@/core/sdk/actions-serveur"
import { enregistrerFichier, rattacherFichier } from "@/core/fichiers/fichiers-serveur"
import { executerPourTeam } from "@/lib/prisma"
import { avecReprisePourConflit } from "@/lib/reprise-conflit"

import { nomAuteur, peutModifierNote, peutRetirer, validerTexteNote } from "./regles"

// Fiche à laquelle les notes et photos sont rattachées : l'app, le type de fiche, l'identifiant.
export interface FicheNotes {
  app: string
  ficheType: string
  ficheId: string
}

// Droits de la fiche, fournis par l'app qui l'appelle. Chaque méthode lève (ErreurMetier ou ErreurAcces) si la personne
// n'a pas le droit ; gerer renvoie simplement vrai ou faux (gestion de l'app de la fiche).
export interface ControleFiche extends FicheNotes {
  voir(ctx: ContexteTeam): Promise<void>
  contribuer(ctx: ContexteTeam): Promise<void>
  gerer(ctx: ContexteTeam): Promise<boolean>
}

export interface NoteFiche {
  id: string
  texte: string
  auteur: string
  creeLe: Date
  modifiable: boolean
  retirable: boolean
}

export interface PhotoFiche {
  id: string
  fileId: string
  nom: string
  auteur: string
  creeLe: Date
  retirable: boolean
}

export interface NotesEtPhotos {
  notes: NoteFiche[]
  photos: PhotoFiche[]
}

function refus(message: string): never {
  throw new ErreurMetier(message)
}

// Lecture : notes et photos de la fiche, les plus récentes d'abord, avec auteur et droits de la personne sur chacune.
export async function notesEtPhotos(ctx: ContexteTeam, controle: ControleFiche): Promise<NotesEtPhotos> {
  await controle.voir(ctx)
  const gere = await controle.gerer(ctx)
  return executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const fiche = { teamId: ctx.teamId, app: controle.app, ficheType: controle.ficheType, ficheId: controle.ficheId, deletedAt: null }
    const [notes, photos] = await Promise.all([
      tx.coreNote.findMany({ where: fiche, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      tx.coreAttachment.findMany({
        where: { ...fiche, role: "photo" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { file: { select: { nom: true, deletedAt: true } } },
      }),
    ])

    const auteurs = Array.from(new Set([...notes.map((n) => n.auteurUserId), ...photos.map((p) => p.createdBy)].filter((id): id is string => id !== null)))
    const personnes = auteurs.length
      ? await tx.corePerson.findMany({ where: { teamId: ctx.teamId, userId: { in: auteurs }, deletedAt: null }, select: { userId: true, prenom: true, nom: true } })
      : []
    const comptes = auteurs.length ? await tx.coreUser.findMany({ where: { id: { in: auteurs } }, select: { id: true, email: true } }) : []
    const nomDe = (userId: string | null) => {
      if (!userId) return "Personne inconnue"
      const personne = personnes.find((p) => p.userId === userId) ?? null
      const compte = comptes.find((c) => c.id === userId) ?? null
      return nomAuteur(personne, compte?.email ?? null)
    }

    return {
      notes: notes.map((n) => ({
        id: n.id,
        texte: n.texte,
        auteur: nomDe(n.auteurUserId),
        creeLe: n.createdAt,
        modifiable: peutModifierNote({ auteurId: n.auteurUserId, userId: ctx.userId }),
        retirable: peutRetirer({ auteurId: n.auteurUserId, userId: ctx.userId, gere }),
      })),
      photos: photos
        .filter((p) => p.file.deletedAt === null)
        .map((p) => ({
          id: p.id,
          fileId: p.fileId,
          nom: p.file.nom,
          auteur: nomDe(p.createdBy),
          creeLe: p.createdAt,
          retirable: peutRetirer({ auteurId: p.createdBy, userId: ctx.userId, gere }),
        })),
    }
  })
}

export async function ajouterNote(ctx: ContexteTeam, controle: ControleFiche, brut: string): Promise<string> {
  await controle.contribuer(ctx)
  const verdict = validerTexteNote(brut)
  if (!verdict.ok) refus(verdict.raison)
  const id = newId()
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    tx.coreNote.create({
      data: {
        id,
        teamId: ctx.teamId,
        app: controle.app,
        ficheType: controle.ficheType,
        ficheId: controle.ficheId,
        auteurUserId: ctx.userId,
        texte: verdict.texte,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    }),
  )
  return id
}

// Modification : l'auteur seul, et seulement tant que la personne voit la fiche.
export async function modifierNote(ctx: ContexteTeam, controle: ControleFiche, id: string, brut: string): Promise<void> {
  await controle.voir(ctx)
  const verdict = validerTexteNote(brut)
  if (!verdict.ok) refus(verdict.raison)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const note = await tx.coreNote.findFirst({
        where: { id, teamId: ctx.teamId, app: controle.app, ficheType: controle.ficheType, ficheId: controle.ficheId, deletedAt: null },
        select: { auteurUserId: true },
      })
      if (!note) refus("Cette note n'existe plus.")
      if (!peutModifierNote({ auteurId: note.auteurUserId, userId: ctx.userId })) refus("Tu ne peux modifier que tes propres notes.")
      await tx.coreNote.updateMany({
        where: { id, teamId: ctx.teamId },
        data: { texte: verdict.texte, updatedBy: ctx.userId, rev: { increment: 1 } },
      })
    }),
  )
}

// Retrait logique : l'auteur, ou la gestion de l'app de la fiche.
export async function retirerNote(ctx: ContexteTeam, controle: ControleFiche, id: string): Promise<void> {
  await controle.voir(ctx)
  const gere = await controle.gerer(ctx)
  await avecReprisePourConflit(() =>
    executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const note = await tx.coreNote.findFirst({
        where: { id, teamId: ctx.teamId, app: controle.app, ficheType: controle.ficheType, ficheId: controle.ficheId, deletedAt: null },
        select: { auteurUserId: true },
      })
      if (!note) refus("Cette note n'existe plus.")
      if (!peutRetirer({ auteurId: note.auteurUserId, userId: ctx.userId, gere })) refus("Seul l'auteur ou la gestion peut retirer cette note.")
      await tx.coreNote.updateMany({
        where: { id, teamId: ctx.teamId },
        data: { deletedAt: new Date(), updatedBy: ctx.userId, rev: { increment: 1 } },
      })
    }),
  )
}

// Ajout d'une photo : le fichier est écrit et contrôlé par le service commun, puis rattaché à la fiche (rôle photo).
export async function ajouterPhoto(ctx: ContexteTeam, controle: ControleFiche, { octets, nomOrigine }: { octets: Uint8Array; nomOrigine: string }): Promise<string> {
  await controle.contribuer(ctx)
  const fichier = await enregistrerFichier(ctx, { octets, nomOrigine })
  await executerPourTeam(ctx.teamId, ctx.userId, (tx) =>
    rattacherFichier(tx, ctx, { fileId: fichier.id, app: controle.app, ficheType: controle.ficheType, ficheId: controle.ficheId, role: "photo" }),
  )
  return fichier.id
}

// Retrait d'une photo : rattachement en retrait logique. Le fichier reste sur le disque.
export async function retirerPhoto(ctx: ContexteTeam, controle: ControleFiche, rattachementId: string): Promise<void> {
  await controle.voir(ctx)
  const gere = await controle.gerer(ctx)
  await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const photo = await tx.coreAttachment.findFirst({
      where: { id: rattachementId, teamId: ctx.teamId, app: controle.app, ficheType: controle.ficheType, ficheId: controle.ficheId, role: "photo", deletedAt: null },
      select: { createdBy: true },
    })
    if (!photo) refus("Cette photo n'existe plus.")
    if (!peutRetirer({ auteurId: photo.createdBy, userId: ctx.userId, gere })) refus("Seul l'auteur ou la gestion peut retirer cette photo.")
    await tx.coreAttachment.updateMany({
      where: { id: rattachementId, teamId: ctx.teamId },
      data: { deletedAt: new Date(), updatedBy: ctx.userId, rev: { increment: 1 } },
    })
  })
}

// Noms affichés des membres ayant une fiche personne liée au compte (« Prénom Nom »), pour l'écran hors ligne :
// les lignes locales ne portent que l'identifiant de l'auteur.
export async function nomsDesMembres(ctx: ContexteTeam): Promise<Record<string, string>> {
  return executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
    const personnes = await tx.corePerson.findMany({
      where: { teamId: ctx.teamId, userId: { not: null }, deletedAt: null },
      select: { userId: true, prenom: true, nom: true },
    })
    return Object.fromEntries(personnes.flatMap((p) => (p.userId ? [[p.userId, `${p.prenom} ${p.nom}`.trim()]] : [])))
  })
}
