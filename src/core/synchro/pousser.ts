// Poussée : chaque opération est traitée dans sa propre transaction (une opération refusée ne
// bloque pas les suivantes). Validation, droits, contribution, application, rev + 1, journal de
// conflit, et trace de l'opération pour l'idempotence (une idOperation rejouée n'est jamais réappliquée).

import type { Prisma } from "@/generated/prisma/client"
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { newId } from "@/core/ids"
import { executerPourTeam, prismaPourTeam } from "@/lib/prisma"

import { decideModification, decideSuppression } from "./conflit"
import { peutEcrire } from "./contribution"
import { resultatDejaNote, type Operation, type ResultatOperation } from "./protocole"
import { declarationDe, type DeclarationSynchro, type Tx } from "./registre"

export async function appliquerOperations(
  ctx: ContexteTeam,
  deviceId: string,
  operations: Operation[],
): Promise<ResultatOperation[]> {
  const resultats: ResultatOperation[] = []
  for (const operation of operations) {
    resultats.push(await appliquerUne(ctx, deviceId, operation))
  }
  return resultats
}

async function appliquerUne(ctx: ContexteTeam, deviceId: string, operation: Operation): Promise<ResultatOperation> {
  // Rejouée : on renvoie le résultat déjà noté, sans rien réappliquer.
  const dejaNotee = await prismaPourTeam(ctx.teamId, ctx.userId).coreSyncOperation.findUnique({
    where: { idOperation: operation.idOperation },
    select: { resultat: true },
  })
  if (dejaNotee) {
    const resultat = resultatDejaNote(operation.idOperation, dejaNotee.resultat)
    if (resultat) return resultat
  }

  const declaration = declarationDe(operation.table)
  if (!declaration) {
    return { idOperation: operation.idOperation, statut: "refusee", raison: "Cette donnée ne se synchronise pas." }
  }

  try {
    const niveau = await niveauDe(ctx, declaration.app)
    return await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const resultat = await decider(tx, ctx, declaration, operation, niveau)
      await tx.coreSyncOperation.create({
        data: {
          id: newId(),
          teamId: ctx.teamId,
          deviceId,
          idOperation: operation.idOperation,
          resultat: { statut: resultat.statut, raison: resultat.raison ?? null } satisfies Prisma.InputJsonValue,
          appliqueeAt: new Date(),
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      return resultat
    })
  } catch (erreur) {
    // Erreur de base : la transaction est annulée, rien n'est appliqué ni noté. Un nouvel envoi réessaiera.
    console.error("[synchro] opération non appliquée :", erreur)
    return { idOperation: operation.idOperation, statut: "refusee", raison: "L'enregistrement n'a pas pu être fait. Réessaie." }
  }
}

async function decider(
  tx: Tx,
  ctx: ContexteTeam,
  declaration: DeclarationSynchro,
  operation: Operation,
  niveau: Parameters<typeof peutEcrire>[0]["niveau"],
): Promise<ResultatOperation> {
  const { idOperation } = operation
  const refus = (raison: string): ResultatOperation => ({ idOperation, statut: "refusee", raison })

  if (operation.type === "creer") {
    const champs = validerChamps(declaration, operation.champs)
    if (!champs.ok) return refus(champs.raison)
    const verdict = peutEcrire({
      niveau,
      contributionPropre: declaration.contributionPropre,
      auteurId: null,
      userId: ctx.userId,
      creation: true,
    })
    if (!verdict.ok) return refus(verdict.raison)
    if (await declaration.trouver(tx, ctx.teamId, operation.id)) return refus("Cet élément existe déjà.")
    await declaration.creer(tx, ctx, operation.id, champs.champs)
    return { idOperation, statut: "appliquee" }
  }

  const etat = await declaration.trouver(tx, ctx.teamId, operation.id)
  if (!etat) return refus("Cet élément n'existe plus.")
  const verdict = peutEcrire({
    niveau,
    contributionPropre: declaration.contributionPropre,
    auteurId: etat.auteurId,
    userId: ctx.userId,
    creation: false,
  })
  if (!verdict.ok) return refus(verdict.raison)
  if (operation.revLue === undefined) return refus("La version lue n'est pas précisée.")
  const revLue = operation.revLue

  if (operation.type === "modifier") {
    const champs = validerChamps(declaration, operation.champs)
    if (!champs.ok) return refus(champs.raison)
    const decision = decideModification({ revLue, revServeur: etat.rev, supprimee: etat.supprimee })
    if (decision === "supprimee_gagne") {
      await journaliser(tx, ctx, declaration, operation.id, { motif: "supprimee", version_ecrite: champs.champs })
      return { idOperation, statut: "conflit_resolu", raison: "Supprimé entre-temps : la modification n'a pas été appliquée." }
    }
    if (decision === "appliquer_et_journaliser") {
      await journaliser(tx, ctx, declaration, operation.id, { motif: "modifiee", version_remplacee: etat.contenu })
    }
    await declaration.modifier(tx, ctx, operation.id, champs.champs)
    return decision === "appliquer" ? { idOperation, statut: "appliquee" } : { idOperation, statut: "conflit_resolu" }
  }

  // Suppression.
  const decision = decideSuppression({ revLue, revServeur: etat.rev, supprimee: etat.supprimee })
  if (decision === "deja_supprimee") return { idOperation, statut: "appliquee" }
  if (decision === "supprimer_et_journaliser") {
    await journaliser(tx, ctx, declaration, operation.id, { motif: "supprimee_apres_modification", version_remplacee: etat.contenu })
  }
  await declaration.supprimer(tx, ctx, operation.id)
  return decision === "supprimer" ? { idOperation, statut: "appliquee" } : { idOperation, statut: "conflit_resolu" }
}

function validerChamps(
  declaration: DeclarationSynchro,
  champs: Record<string, unknown> | undefined,
): { ok: true; champs: Record<string, unknown> } | { ok: false; raison: string } {
  const analyse = declaration.schemaChamps.safeParse(champs ?? {})
  if (!analyse.success) {
    return { ok: false, raison: analyse.error.issues[0]?.message ?? "Les champs ne sont pas valides." }
  }
  return { ok: true, champs: analyse.data }
}

// Journal : la version écrasée est conservée dans core_activity, action « conflit_synchro ».
async function journaliser(
  tx: Tx,
  ctx: ContexteTeam,
  declaration: DeclarationSynchro,
  ficheId: string,
  resume: Record<string, unknown>,
): Promise<void> {
  await tx.coreActivity.create({
    data: {
      id: newId(),
      teamId: ctx.teamId,
      app: "core",
      ficheType: declaration.ficheType,
      ficheId,
      action: "conflit_synchro",
      auteurUserId: ctx.userId,
      resume: resume as Prisma.InputJsonValue,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })
}
