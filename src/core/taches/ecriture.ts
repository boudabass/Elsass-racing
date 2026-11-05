// Écriture des tâches du socle (core_task) pour les apps (tâche 5.8, §3.2). Une app n'écrit jamais core_task : elle appelle
// ces fonctions avec la transaction de sa propre écriture, pour que la tâche naisse, change ou disparaisse avec la fiche.
// Les contrôles de droits restent dans l'app (un contrôle de la fiche n'est pas une règle du socle).

import { newId } from "@/core/ids"
import type { Prisma } from "@/generated/prisma/client"

// Le contexte d'écriture : une team, et un auteur quand il y en a un (un contexte système n'en a pas).
export interface ContexteTaches {
  teamId: string
  userId?: string | null
}

// Le client d'une transaction ou le client de la team hors transaction : les deux exposent ces trois écritures de core_task.
// Forme volontairement étroite (les clients étendus de Prisma ne sont pas assignables au type de transaction).
export interface ClientTaches {
  coreTask: {
    create(args: { data: Prisma.CoreTaskUncheckedCreateInput }): Promise<unknown>
    update(args: { where: Prisma.CoreTaskWhereUniqueInput; data: Prisma.CoreTaskUncheckedUpdateInput }): Promise<unknown>
    updateMany(args: { where: Prisma.CoreTaskWhereInput; data: Prisma.CoreTaskUncheckedUpdateManyInput }): Promise<unknown>
  }
}

export interface FicheTache {
  app: string
  ficheType: string
  ficheId: string
}

export interface NouvelleTache extends FicheTache {
  // Identifiant fourni quand l'app en a besoin pour la suite (une même valeur dans sa propre écriture).
  id?: string
  eventId?: string | null
  titre: string
  assigneePersonId?: string | null
  echeance?: Date | null
}

export async function creerTache(client: ClientTaches, ctx: ContexteTaches, tache: NouvelleTache): Promise<string> {
  const id = tache.id ?? newId()
  await client.coreTask.create({
    data: {
      id,
      teamId: ctx.teamId,
      app: tache.app,
      ficheType: tache.ficheType,
      ficheId: tache.ficheId,
      eventId: tache.eventId ?? null,
      titre: tache.titre,
      assigneePersonId: tache.assigneePersonId ?? null,
      echeance: tache.echeance ?? null,
      statut: "a_faire",
      createdBy: ctx.userId ?? null,
      updatedBy: ctx.userId ?? null,
    },
  })
  return id
}

// Retire les tâches d'une fiche qui disparaît (affectation retirée) : elles ne restent à faire pour personne.
export async function retirerTaches(client: ClientTaches, ctx: ContexteTaches, fiche: FicheTache): Promise<void> {
  await client.coreTask.updateMany({
    where: { teamId: ctx.teamId, app: fiche.app, ficheType: fiche.ficheType, ficheId: fiche.ficheId, deletedAt: null },
    data: { deletedAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId ?? null },
  })
}

// Coche ou décoche une tâche par son identifiant. Le contrôle de la personne assignée reste dans l'app.
export async function definirStatutTache(client: ClientTaches, ctx: ContexteTaches, id: string, fait: boolean): Promise<void> {
  await client.coreTask.update({
    where: { id },
    data: { statut: fait ? "fait" : "a_faire", faitAt: fait ? new Date() : null, rev: { increment: 1 }, updatedBy: ctx.userId ?? null },
  })
}

// Termine les tâches à faire d'une fiche : c'est ce que fait la levée de l'action qui les portait (préfixe « tache_ »).
export async function terminerTachesOuvertes(client: ClientTaches, ctx: ContexteTaches, fiche: FicheTache): Promise<void> {
  await client.coreTask.updateMany({
    where: { teamId: ctx.teamId, app: fiche.app, ficheType: fiche.ficheType, ficheId: fiche.ficheId, statut: "a_faire", deletedAt: null },
    data: { statut: "fait", faitAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId ?? null },
  })
}

// Termine les tâches à faire d'un type de fiche dont la fiche n'est plus dans la liste donnée (rattrapage du QG : les tâches
// orphelines d'un point qui n'est plus en problème se ferment sans action à lever).
export async function terminerTachesSauf(client: ClientTaches, ctx: ContexteTaches, type: { app: string; ficheType: string }, idsGardes: string[]): Promise<void> {
  await client.coreTask.updateMany({
    where: {
      teamId: ctx.teamId,
      app: type.app,
      ficheType: type.ficheType,
      statut: "a_faire",
      deletedAt: null,
      ficheId: { notIn: idsGardes },
    },
    data: { statut: "fait", faitAt: new Date(), rev: { increment: 1 }, updatedBy: ctx.userId ?? null },
  })
}
