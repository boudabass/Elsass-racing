import type { CoreRole } from "@/generated/prisma/client"

import { prisma, prismaPourTeam } from "@/lib/prisma"
import { manifestes } from "@/apps/registre"

import { calculerApps, type AppVisible } from "./apps"

// Apps visibles pour un membre d'une team : activées, de niveau au moins lecture.
// Vient de la garde (exigerAcces) ou du contexte équivalent.
export async function appsVisibles(ctx: {
  teamId: string
  userId: string
  membership: { id: string; role: CoreRole }
}): Promise<AppVisible[]> {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [activees, acces, defauts] = await Promise.all([
    client.coreTeamApp.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: { appCle: true, activee: true, ordre: true },
    }),
    client.coreAppAccess.findMany({
      where: { membershipId: ctx.membership.id },
      select: { appCle: true, niveau: true },
    }),
    prisma.coreRoleDefault.findMany({
      where: { role: ctx.membership.role },
      select: { role: true, appCle: true, niveau: true },
    }),
  ])

  return calculerApps({
    role: ctx.membership.role,
    activees,
    acces,
    defauts,
    registre: manifestes(),
    avertir: (message) => console.warn(message),
  })
}
