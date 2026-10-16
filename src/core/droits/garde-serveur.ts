import { prisma, prismaPourTeam } from "@/lib/prisma"
import { lireSession } from "@/core/auth/session-serveur"
import { teamCourante } from "@/core/auth/team-serveur"

import { ErreurAcces } from "./erreurs"
import { aAuMoins, niveauEffectif, type Niveau } from "./niveaux"

// Contexte minimal : session, team courante et membership, sans niveau d'app. Pour les
// pages et les actions qui ne visent pas une app précise (QG, recherche, boîte d'actions).
export async function exigerContexte() {
  const session = await lireSession()
  if (!session) throw new ErreurAcces("non_connecte", "aucun", "lecture", "")

  const courante = await teamCourante()
  if (!courante) throw new ErreurAcces("aucune_team", "aucun", "lecture", "")

  const { team, membership } = courante
  return {
    session,
    team,
    membership,
    contexte: {
      teamId: team.id,
      userId: session.userId,
      membership: { id: membership.id, role: membership.role },
    },
  }
}

// Garde de toute Server Action qui touche une app. À appeler en premier :
//   const { team, membership } = await exigerAcces("budget", "ecriture")
// Lève ErreurAcces si la session, la team ou le niveau ne suffisent pas.
export async function exigerAcces(appCle: string, requis: Niveau) {
  const session = await lireSession()
  if (!session) throw new ErreurAcces("non_connecte", "aucun", requis, appCle)

  const courante = await teamCourante()
  if (!courante) throw new ErreurAcces("aucune_team", "aucun", requis, appCle)

  const { team, membership } = courante
  const [acces, defauts] = await Promise.all([
    prismaPourTeam(team.id, session.userId).coreAppAccess.findMany({
      where: { membershipId: membership.id, appCle },
      select: { appCle: true, niveau: true },
    }),
    prisma.coreRoleDefault.findMany({
      where: { role: membership.role, appCle },
      select: { role: true, appCle: true, niveau: true },
    }),
  ])

  const niveau = niveauEffectif({ role: membership.role, appCle, acces, defauts })
  if (!aAuMoins(niveau, requis)) throw new ErreurAcces("niveau_insuffisant", niveau, requis, appCle)

  return { session, team, membership, niveau }
}
