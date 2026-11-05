// Contrôle de lecture des justificatifs de Budget (tâche 5.8, §3.1). Un ticket se lit si sa dépense se voit : la lecture et
// l'écriture voient tout, la contribution seulement ses dépenses (depensesVisibles). L'assistance n'a donc pas les tickets
// des autres, ni les montants qui vont avec.
import type { ControleLecture } from "@/core/fichiers/controles-lecture"

import { origineDepensesBudget } from "./origine-fichiers"

export const controleLectureBudget: ControleLecture = {
  app: "budget",
  ficheType: "expense",
  async peutLire(ctx, depenseId) {
    const visibles = await origineDepensesBudget.fichesVisibles(ctx, [depenseId])
    return visibles.length > 0
  },
}
