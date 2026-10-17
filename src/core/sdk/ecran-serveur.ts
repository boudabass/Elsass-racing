// Garde commune des écrans d'une app : l'app doit être activée pour la team, et le membre doit avoir au
// moins le niveau demandé. Sinon, l'écran de refus (titre et lignes) s'affiche. Chaque app l'appelle
// avec son accès serveur (accesSaison, accesBudget…) et son titre.

import type { ContexteTeam } from "@/core/contexte"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import type { Niveau } from "@/core/droits/niveaux"
import { contexteQg, redirigerSiSansContexte } from "@/core/qg/donnees"
import { prismaPourTeam } from "@/lib/prisma"

export type AccesEcran =
  | { ok: true; niveau: Niveau; ctx: { teamId: string; userId: string } }
  | { ok: false; titre: string; lignes: string[] }

export async function accesEcranApp(
  appCle: string,
  titre: string,
  acces: (requis: Niveau) => Promise<{ ctx: ContexteTeam; niveau: Niveau }>,
  requis: Niveau,
): Promise<AccesEcran> {
  const { contexte } = await contexteQg().catch((erreur: unknown) => {
    redirigerSiSansContexte(erreur)
    throw erreur
  })
  const activation = await prismaPourTeam(contexte.teamId, contexte.userId).coreTeamApp.findFirst({
    where: { teamId: contexte.teamId, appCle, activee: true, deletedAt: null },
    select: { id: true },
  })
  if (!activation) {
    return {
      ok: false,
      titre,
      lignes: ["Cette app n'est pas activée pour ta team.", "Le responsable peut l'activer depuis les réglages."],
    }
  }

  try {
    const { ctx, niveau } = await acces(requis)
    return { ok: true, niveau, ctx: { teamId: ctx.teamId, userId: ctx.userId } }
  } catch (erreur) {
    redirigerSiSansContexte(erreur)
    if (erreur instanceof ErreurAcces) {
      return { ok: false, titre: "Tu n'as pas accès à cette app", lignes: [libelleErreurAcces(erreur)] }
    }
    throw erreur
  }
}
