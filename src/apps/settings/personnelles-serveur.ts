import { prisma, prismaPourCompte, prismaPourTeam } from "@/lib/prisma"
import type { ContexteTeam } from "@/core/contexte"
import type { AppVisible } from "@/core/sdk/apps"

// Lectures des rubriques personnelles. Les appareils n'ont pas de team : ils se lisent avec le
// client sans contexte, et seulement pour le compte courant, ou pour les membres de la team
// quand le lecteur est responsable.

export const CANAUX_NOTIFIABLES = ["app", "mail"] as const

export interface LigneNotification {
  appCle: string
  nom: string
  app: boolean
  mail: boolean
  regroupement: "immediat" | "quotidien"
}

// Une ligne par app visible : les canaux activés et le regroupement (immédiat ou quotidien).
export async function listerNotifications(ctx: ContexteTeam, apps: AppVisible[]): Promise<LigneNotification[]> {
  const lignes = await prismaPourTeam(ctx.teamId, ctx.userId).coreNotificationPref.findMany({
    where: { membershipId: ctx.membership.id, type: "general" },
    select: { app: true, canal: true, actif: true, regroupement: true },
  })
  return apps.map((app) => {
    const deLApp = lignes.filter((l) => l.app === app.manifeste.cle)
    const canal = (nom: string) => deLApp.find((l) => l.canal === nom)
    const regroupement = deLApp.find((l) => l.regroupement === "quotidien") ? "quotidien" : "immediat"
    return {
      appCle: app.manifeste.cle,
      nom: app.manifeste.nom,
      app: canal("app")?.actif ?? true,
      mail: canal("mail")?.actif ?? true,
      regroupement,
    }
  })
}

export interface LigneAppareil {
  id: string
  nom: string
  plateforme: string
  derniereActivite: Date
  proprietaire: string
  estCetAppareil: boolean
  estMien: boolean
}

// Mes appareils. Pour le responsable : aussi ceux des membres de la team.
export async function listerAppareils(ctx: ContexteTeam, appareilCourant: string, responsable: boolean): Promise<LigneAppareil[]> {
  const membres = responsable
    ? await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findMany({
        where: { teamId: ctx.teamId, statut: { not: "parti" } },
        select: { userId: true, user: { select: { email: true } }, person: { select: { prenom: true, nom: true } } },
      })
    : []

  const userIds = responsable ? membres.map((m) => m.userId) : [ctx.userId]
  const libelles = new Map<string, string>()
  membres.forEach((m) => libelles.set(m.userId, m.person ? `${m.person.prenom} ${m.person.nom}` : m.user.email))

  const appareils = await prisma.coreDevice.findMany({
    where: { userId: { in: userIds }, deletedAt: null },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  })

  return appareils.map((a) => ({
    id: a.id,
    nom: a.nom,
    plateforme: a.plateforme,
    derniereActivite: a.derniereSyncAt ?? a.createdAt,
    proprietaire: libelles.get(a.userId) ?? a.user.email,
    estCetAppareil: a.id === appareilCourant,
    estMien: a.userId === ctx.userId,
  }))
}

export interface LigneExport {
  id: string
  perimetre: string
  statut: string
  demandeeLe: Date
  demandeur: string
}

// Mes exports, et pour le responsable : tous les exports de la team.
export async function listerExports(ctx: ContexteTeam, responsable: boolean): Promise<LigneExport[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const exports = await client.coreExport.findMany({
    where: { teamId: ctx.teamId, ...(responsable ? {} : { demandeParUserId: ctx.userId }) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, perimetre: true, statut: true, createdAt: true, demandeParUserId: true },
  })
  const demandeurs = await prisma.coreUser.findMany({
    where: { id: { in: exports.map((e) => e.demandeParUserId) } },
    select: { id: true, email: true },
  })
  return exports.map((e) => ({
    id: e.id,
    perimetre: e.perimetre,
    statut: e.statut,
    demandeeLe: e.createdAt,
    demandeur: demandeurs.find((d) => d.id === e.demandeParUserId)?.email ?? "",
  }))
}

export interface LigneSuppression {
  id: string
  portee: "compte" | "team"
  purgePrevueAt: Date
  annulable: boolean
}

// Demandes de suppression en cours (ni annulées, ni exécutées) de la team.
export async function listerSuppressions(ctx: ContexteTeam): Promise<LigneSuppression[]> {
  const demandes = await prismaPourTeam(ctx.teamId, ctx.userId).settingsDeletionRequest.findMany({
    where: { teamId: ctx.teamId, annuleeAt: null, executeeAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, portee: true, purgePrevueAt: true, userId: true },
  })
  return demandes.map((d) => ({
    id: d.id,
    portee: d.portee === "compte" ? "compte" : "team",
    purgePrevueAt: d.purgePrevueAt,
    annulable: true,
  }))
}

export interface AdhesionCompte {
  teamId: string
  teamNom: string
  membershipId: string
  role: string
  statut: string
  autresResponsablesActifs: number
}

// Mes adhésions actives, avec le nombre d'autres responsables actifs dans chaque team. Les
// membres d'une team se lisent dans le contexte de cette team (RLS).
export async function adhesionsDuCompte(userId: string): Promise<AdhesionCompte[]> {
  const mes = await prismaPourCompte(userId).coreMembership.findMany({
    where: { userId, statut: "actif", deletedAt: null, team: { statut: "active", deletedAt: null } },
    select: { id: true, teamId: true, role: true, statut: true, team: { select: { nom: true } } },
    orderBy: { team: { nom: "asc" } },
  })

  const resultat: AdhesionCompte[] = []
  for (const adhesion of mes) {
    const membres = await prismaPourTeam(adhesion.teamId, userId).coreMembership.findMany({
      where: { teamId: adhesion.teamId, statut: "actif" },
      select: { id: true, role: true },
    })
    resultat.push({
      teamId: adhesion.teamId,
      teamNom: adhesion.team.nom,
      membershipId: adhesion.id,
      role: adhesion.role,
      statut: adhesion.statut,
      autresResponsablesActifs: membres.filter((m) => m.id !== adhesion.id && m.role === "responsable").length,
    })
  }
  return resultat
}
