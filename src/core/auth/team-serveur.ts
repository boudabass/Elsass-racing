import { cookies } from "next/headers"

import { prisma } from "@/lib/prisma"

import { COOKIE_TEAM, signerTeam, verifierTeam } from "./session"
import { lireSession, optionsCookie, type MagasinCookies } from "./session-serveur"

// Teams où le compte est membre actif, et dont la team est active.
export async function listerTeamsDe(userId: string) {
  const adhesions = await prisma.coreMembership.findMany({
    where: { userId, statut: "actif", deletedAt: null, team: { statut: "active", deletedAt: null } },
    include: { team: true },
    orderBy: { team: { nom: "asc" } },
  })
  return adhesions.map((adhesion) => ({ team: adhesion.team, role: adhesion.role }))
}

// Pose la team courante, après avoir revérifié l'adhésion active. Ne fait pas confiance
// au cookie seul : un membre retiré d'une team ne doit plus pouvoir y entrer.
export async function choisirTeam(teamId: string, magasin: MagasinCookies, userId: string): Promise<boolean> {
  const adhesion = await prisma.coreMembership.findFirst({
    where: { teamId, userId, statut: "actif", deletedAt: null, team: { statut: "active", deletedAt: null } },
    select: { id: true },
  })
  if (!adhesion) return false
  magasin.set(COOKIE_TEAM, await signerTeam(teamId), optionsCookie())
  return true
}

// La team et l'adhésion courantes, ou null. Revérifie session, cookie et adhésion à chaque appel.
export async function teamCourante() {
  const session = await lireSession()
  if (!session) return null

  const jeton = (await cookies()).get(COOKIE_TEAM)?.value
  if (!jeton) return null
  const teamId = await verifierTeam(jeton)
  if (!teamId) return null

  const adhesion = await prisma.coreMembership.findFirst({
    where: {
      teamId,
      userId: session.userId,
      statut: "actif",
      deletedAt: null,
      team: { statut: "active", deletedAt: null },
    },
    include: { team: true },
  })
  if (!adhesion) return null
  return { team: adhesion.team, membership: adhesion }
}
