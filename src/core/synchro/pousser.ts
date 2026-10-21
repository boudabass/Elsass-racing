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
import { RefusSynchro } from "./erreurs"
import { declarationDe, type DeclarationSynchro, type Tx } from "./registre"

// Ce que la décision a fait : le résultat à renvoyer, et si la ligne a été écrite. Les effets après
// application (apresApplication) ne suivent que les écritures : une suppression déjà faite, ou une
// modification perdue face à une suppression, n'émet rien.
interface Decision {
  resultat: ResultatOperation
  ecrit: boolean
}

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

  // Lecture seule : ce qui vient de la base n'est jamais réécrit par un appareil.
  if (declaration.lectureSeule) {
    return { idOperation: operation.idOperation, statut: "refusee", raison: "Cette donnée se lit seulement hors ligne : elle ne s'écrit pas depuis l'appareil." }
  }

  let decision: Decision
  try {
    const niveau = await niveauDe(ctx, declaration.app)
    decision = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => {
      const enCours = await decider(tx, ctx, declaration, operation, niveau)
      await tx.coreSyncOperation.create({
        data: {
          id: newId(),
          teamId: ctx.teamId,
          deviceId,
          idOperation: operation.idOperation,
          resultat: { statut: enCours.resultat.statut, raison: enCours.resultat.raison ?? null } satisfies Prisma.InputJsonValue,
          appliqueeAt: new Date(),
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      })
      return enCours
    })
  } catch (erreur) {
    // Refus métier levé dans la transaction : rien n'est écrit, le message part à l'appareil.
    if (erreur instanceof RefusSynchro) return { idOperation: operation.idOperation, statut: "refusee", raison: erreur.message }
    // Erreur de base : la transaction est annulée, rien n'est appliqué ni noté. Un nouvel envoi réessaiera.
    console.error("[synchro] opération non appliquée :", erreur)
    return { idOperation: operation.idOperation, statut: "refusee", raison: "L'enregistrement n'a pas pu être fait. Réessaie." }
  }

  // La transaction est validée : ce qui suit ne peut plus la défaire, et son échec ne change pas le résultat.
  // Vaut pour toute écriture, appliquée ou conflit résolu (un ordre terminé par une modification en conflit
  // doit émettre comme les autres) ; une écriture sans effet n'émet rien.
  if (decision.ecrit && declaration.apresApplication) {
    await declaration.apresApplication(ctx, operation.id, operation.type).catch((erreur: unknown) => console.error("[synchro] suite non faite :", erreur))
  }
  return decision.resultat
}

async function decider(
  tx: Tx,
  ctx: ContexteTeam,
  declaration: DeclarationSynchro,
  operation: Operation,
  niveau: Parameters<typeof peutEcrire>[0]["niveau"],
): Promise<Decision> {
  const { idOperation } = operation
  const refus = (raison: string): Decision => ({ resultat: { idOperation, statut: "refusee", raison }, ecrit: false })
  const ecriture = (statut: "appliquee" | "conflit_resolu"): Decision => ({ resultat: { idOperation, statut }, ecrit: true })

  if (operation.type === "creer") {
    const champs = validerChamps(declaration, operation.champs)
    if (!champs.ok) return refus(champs.raison)
    const verdict = peutEcrire({
      niveau,
      contributionPropre: declaration.contributionPropre,
      regle: declaration.regleContribution,
      auteurId: null,
      userId: ctx.userId,
      creation: true,
    })
    if (!verdict.ok) return refus(verdict.raison)
    if (await declaration.trouver(tx, ctx.teamId, operation.id)) return refus("Cet élément existe déjà.")
    await declaration.creer(tx, ctx, operation.id, champs.champs)
    return ecriture("appliquee")
  }

  const etat = await declaration.trouver(tx, ctx.teamId, operation.id)
  if (!etat) return refus("Cet élément n'existe plus.")
  const verdict = peutEcrire({
    niveau,
    contributionPropre: declaration.contributionPropre,
    regle: declaration.regleContribution,
    affecte: await estAffecte(tx, ctx, declaration, operation.id),
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
    const verdictConflit = decideModification({ revLue, revServeur: etat.rev, supprimee: etat.supprimee })
    if (verdictConflit === "supprimee_gagne") {
      await journaliser(tx, ctx, declaration, operation.id, { motif: "supprimee", version_ecrite: champs.champs })
      return { resultat: { idOperation, statut: "conflit_resolu", raison: "Supprimé entre-temps : la modification n'a pas été appliquée." }, ecrit: false }
    }
    // L'écriture d'abord : si la ligne a disparu entre-temps, rien n'est journalisé.
    if (!(await declaration.modifier(tx, ctx, operation.id, champs.champs))) return refus("Cet élément n'existe plus.")
    if (verdictConflit === "appliquer_et_journaliser") {
      await journaliser(tx, ctx, declaration, operation.id, { motif: "modifiee", version_remplacee: etat.contenu })
    }
    return verdictConflit === "appliquer" ? ecriture("appliquee") : ecriture("conflit_resolu")
  }

  // Suppression.
  const verdictConflit = decideSuppression({ revLue, revServeur: etat.rev, supprimee: etat.supprimee })
  if (verdictConflit === "deja_supprimee") return { resultat: { idOperation, statut: "appliquee" }, ecrit: false }
  if (!(await declaration.supprimer(tx, ctx, operation.id))) return refus("Cet élément n'existe plus.")
  if (verdictConflit === "supprimer_et_journaliser") {
    await journaliser(tx, ctx, declaration, operation.id, { motif: "supprimee_apres_modification", version_remplacee: etat.contenu })
  }
  return verdictConflit === "supprimer" ? ecriture("appliquee") : ecriture("conflit_resolu")
}

// Seulement pour la règle « affectation » : la table dit si le membre est affecté à la ligne. Sans
// fonction d'affectation, la ligne est refusée au niveau contribution (défaut sûr).
async function estAffecte(tx: Tx, ctx: ContexteTeam, declaration: DeclarationSynchro, id: string): Promise<boolean> {
  if (declaration.regleContribution !== "affectation" || !declaration.affecte) return false
  return declaration.affecte(tx, ctx.teamId, ctx.userId, id)
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
