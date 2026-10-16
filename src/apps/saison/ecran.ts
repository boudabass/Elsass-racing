// Garde des écrans de Saison : l'app doit être activée pour la team, et le membre doit avoir au
// moins le niveau demandé. Sinon, l'écran de refus existant (titre et lignes) s'affiche.

import { prismaPourTeam } from "@/lib/prisma"
import { contexteQg } from "@/core/qg/donnees"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import type { Niveau } from "@/core/droits/niveaux"

import { accesSaison } from "./services-serveur"

export type AccesEcran = { ok: true; niveau: Niveau } | { ok: false; titre: string; lignes: string[] }

export async function accesEcran(requis: Niveau): Promise<AccesEcran> {
  const { contexte } = await contexteQg()
  const activation = await prismaPourTeam(contexte.teamId, contexte.userId).coreTeamApp.findFirst({
    where: { teamId: contexte.teamId, appCle: "saison", activee: true, deletedAt: null },
    select: { id: true },
  })
  if (!activation) {
    return {
      ok: false,
      titre: "Saison",
      lignes: ["Cette app n'est pas activée pour ta team.", "Le responsable peut l'activer depuis les réglages."],
    }
  }

  try {
    const { niveau } = await accesSaison(requis)
    return { ok: true, niveau }
  } catch (erreur) {
    if (erreur instanceof ErreurAcces) {
      return { ok: false, titre: "Tu n'as pas accès à cette app", lignes: [libelleErreurAcces(erreur)] }
    }
    throw erreur
  }
}
