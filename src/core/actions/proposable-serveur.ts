// Une action d'échéance se propose à chaque recalcul de son app : son rang suit la date (9 puis 2 le jour J).
// Elle se propose tant qu'elle n'a pas été décidée, expirée ou levée : une action qui n'est plus en attente ne revient pas
// d'elle-même (une nouvelle décision se fait par l'app d'origine). Lecture seule de core_action.

import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

export async function actionEcheanceProposable(
  client: ReturnType<typeof prismaPourTeam>,
  ctx: ContexteTeam,
  cleUnicite: string,
): Promise<boolean> {
  const dejaTraitee = await client.coreAction.findFirst({
    where: { teamId: ctx.teamId, cleUnicite, statut: { not: "en_attente" } },
    select: { id: true },
  })
  return dejaTraitee === null
}
