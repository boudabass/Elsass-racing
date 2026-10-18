// Client Prisma d'un contexte d'événement (brief 3.8, point 0.3) : celui de l'utilisateur, ou celui de la team seule.
import "server-only"

import { prismaPourTeam, prismaPourTeamSysteme } from "@/lib/prisma"

import { estContexteTeam, type ContexteEvenement } from "./contexte"

export function clientPourContexte(ctx: ContexteEvenement) {
  return estContexteTeam(ctx) ? prismaPourTeam(ctx.teamId, ctx.userId) : prismaPourTeamSysteme(ctx.teamId)
}
