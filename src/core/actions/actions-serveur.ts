import { prisma, prismaPourTeam } from "@/lib/prisma"
import { aAuMoins, niveauEffectif, type Niveau } from "@/core/droits/niveaux"
import { emettre } from "@/core/evenements/bus-serveur"
import type { ContexteTeam } from "@/core/contexte"

import { actionsPourMembre, lireDestinataires, type ActionBoite, type Bouton } from "./filtrage"
import { grouperActions, type GroupeAction } from "./regroupement"

// Une action en attente depuis plus de ce délai après son échéance passe à expirée.
const DELAI_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000

// Niveau effectif du membre sur une app : core_app_access, sinon le défaut du rôle.
export async function niveauDe(ctx: ContexteTeam, appCle: string): Promise<Niveau> {
  const [acces, defauts] = await Promise.all([
    prismaPourTeam(ctx.teamId, ctx.userId).coreAppAccess.findMany({
      where: { membershipId: ctx.membership.id, appCle },
      select: { appCle: true, niveau: true },
    }),
    prisma.coreRoleDefault.findMany({
      where: { role: ctx.membership.role, appCle },
      select: { role: true, appCle: true, niveau: true },
    }),
  ])
  return niveauEffectif({ role: ctx.membership.role, appCle, acces, defauts })
}

function lireBoutons(json: unknown): Bouton[] {
  return Array.isArray(json) ? (json as Bouton[]) : []
}

// Décide une action : le membre doit en être destinataire, avoir le niveau requis sur l'app
// d'origine, et le bouton doit exister. Émet ensuite core.action_decidee vers l'app d'origine.
export async function decider(ctx: ContexteTeam, actionId: string, cleBouton: string): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const action = await client.coreAction.findFirst({
    where: { id: actionId, teamId: ctx.teamId },
  })
  if (!action) throw new Error("Action introuvable dans cette team.")
  if (action.statut !== "en_attente") throw new Error("Cette action n'est plus en attente.")

  const destinataires = lireDestinataires(action.destinataires)
  const destinataire =
    destinataires.roles.includes(ctx.membership.role) || destinataires.memberships.includes(ctx.membership.id)
  if (!destinataire) throw new Error("Tu n'es pas destinataire de cette action.")

  const niveau = await niveauDe(ctx, action.appOrigine)
  if (!aAuMoins(niveau, destinataires.niveauRequis)) {
    throw new Error(`Niveau insuffisant sur ${action.appOrigine} : « ${destinataires.niveauRequis} » requis.`)
  }

  const boutons = lireBoutons(action.boutons)
  if (!boutons.some((b) => b.cle === cleBouton)) throw new Error("Bouton inconnu pour cette action.")

  await client.coreAction.update({
    where: { id: action.id },
    data: {
      statut: "decidee",
      decision: cleBouton,
      decideeParMembershipId: ctx.membership.id,
      decideeAt: new Date(),
      messageRefus: null,
    },
  })

  // Livraison unique vers l'app d'origine : le destinataire est porté par les données.
  await emettre(
    ctx,
    "core.action_decidee",
    {
      actionId: action.id,
      appOrigine: action.appOrigine,
      type: action.type,
      cleUnicite: action.cleUnicite,
      decision: cleBouton,
      ficheType: action.ficheType,
      ficheId: action.ficheId,
      eventId: action.eventId,
    },
    1,
    { destinataires: [action.appOrigine] },
  )
}

// Reporte une action jusqu'à une date : elle sort de la liste jusque-là.
export async function reporter(ctx: ContexteTeam, actionId: string, jusquAu: Date): Promise<void> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const resultat = await client.coreAction.updateMany({
    where: { id: actionId, teamId: ctx.teamId, statut: "en_attente" },
    data: { reporteeJusquAu: jusquAu },
  })
  if (resultat.count !== 1) throw new Error("Action introuvable ou plus en attente.")
}

// Actions en attente, non reportées, visibles par le membre, groupées par cleRegroupement.
export async function listerActionsEnAttente(ctx: ContexteTeam): Promise<GroupeAction[]> {
  return grouperActions(await listerActionsVisibles(ctx))
}

// Même liste, à plat : pour le bouton Prochaine étape et le compteur de la barre haute.
export async function listerActionsVisibles(ctx: ContexteTeam): Promise<ActionBoite[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const maintenant = new Date()

  // Expiration : échéance dépassée de plus de 30 jours.
  await client.coreAction.updateMany({
    where: {
      teamId: ctx.teamId,
      statut: "en_attente",
      echeance: { lt: new Date(maintenant.getTime() - DELAI_EXPIRATION_MS) },
    },
    data: { statut: "expiree" },
  })

  const lignes = await client.coreAction.findMany({
    where: {
      teamId: ctx.teamId,
      statut: "en_attente",
      OR: [{ reporteeJusquAu: null }, { reporteeJusquAu: { lte: maintenant } }],
    },
    orderBy: [{ priorite: "asc" }, { echeance: "asc" }, { createdAt: "asc" }],
  })

  const actions: ActionBoite[] = lignes.map((l) => ({
    messageRefus: l.messageRefus,
    id: l.id,
    appOrigine: l.appOrigine,
    type: l.type,
    cleUnicite: l.cleUnicite,
    titre: l.titre,
    contexte: l.contexte,
    ficheType: l.ficheType,
    ficheId: l.ficheId,
    eventId: l.eventId,
    priorite: l.priorite,
    bloquant: l.bloquant,
    echeance: l.echeance,
    cleRegroupement: l.cleRegroupement,
    destinataires: lireDestinataires(l.destinataires),
    boutons: lireBoutons(l.boutons),
    createdAt: l.createdAt,
    reporteeJusquAu: l.reporteeJusquAu,
    statut: l.statut,
  }))

  const niveauParApp: Record<string, Niveau> = {}
  for (const appCle of Array.from(new Set(actions.map((a) => a.appOrigine)))) {
    niveauParApp[appCle] = await niveauDe(ctx, appCle)
  }

  const visibles = actionsPourMembre(actions, {
    membershipId: ctx.membership.id,
    role: ctx.membership.role,
    niveauParApp,
  })
  return visibles
}
