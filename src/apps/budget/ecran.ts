// Garde des écrans de Budget : l'app doit être activée pour la team, et le membre doit avoir au moins le
// niveau demandé. Sinon, l'écran de refus existant (titre et lignes) s'affiche.

import { prismaPourTeam } from "@/lib/prisma"
import { contexteQg } from "@/core/qg/donnees"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import type { Niveau } from "@/core/droits/niveaux"

import { accesBudget } from "./services-serveur"

export type AccesEcran = { ok: true; niveau: Niveau; ctx: { teamId: string; userId: string } } | { ok: false; titre: string; lignes: string[] }

export async function accesEcran(requis: Niveau): Promise<AccesEcran> {
  const { contexte } = await contexteQg()
  const activation = await prismaPourTeam(contexte.teamId, contexte.userId).coreTeamApp.findFirst({
    where: { teamId: contexte.teamId, appCle: "budget", activee: true, deletedAt: null },
    select: { id: true },
  })
  if (!activation) {
    return {
      ok: false,
      titre: "Budget",
      lignes: ["Cette app n'est pas activée pour ta team.", "Le responsable peut l'activer depuis les réglages."],
    }
  }

  try {
    const { ctx, niveau } = await accesBudget(requis)
    return { ok: true, niveau, ctx: { teamId: ctx.teamId, userId: ctx.userId } }
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) {
      return { ok: false, titre: "Tu n'as pas accès à cette app", lignes: [libelleErreurAcces(erreur)] }
    }
    throw erreur
  }
}
