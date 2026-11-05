// Contrôle de lecture des photos d'ordre de travail (tâche 5.8, §3.1). Une photo se lit si son ordre est visible : la
// lecture et l'écriture voient tous les ordres, la contribution seulement ceux où elle est affectée (controleOrdre.voir).
import { ErreurAcces } from "@/core/droits/erreurs"
import type { ControleLecture } from "@/core/fichiers/controles-lecture"
import { ErreurMetier } from "@/core/sdk/actions-serveur"

import { controleOrdre } from "./notes-serveur"

export const controleLectureGarage: ControleLecture = {
  app: "garage",
  ficheType: "ordre",
  async peutLire(ctx, ordreId) {
    try {
      await controleOrdre(ordreId).voir(ctx)
      return true
    } catch (erreur) {
      if (erreur instanceof ErreurMetier || erreur instanceof ErreurAcces) return false
      throw erreur
    }
  },
}
