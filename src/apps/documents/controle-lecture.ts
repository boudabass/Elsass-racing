// Contrôle de lecture des fichiers de Documents (tâche 5.8, §3.1). La version d'un document se lit si le document se voit :
// même règle que le coffre (peutVoirDocument), donc un dossier caché ne s'ouvre que par un accès interne.
import type { ControleLecture } from "@/core/fichiers/controles-lecture"

import { origineVersionsDocuments } from "./origine-fichiers"

export const controleLectureDocuments: ControleLecture = {
  app: "documents",
  ficheType: "documents_version",
  async peutLire(ctx, versionId) {
    const visibles = await origineVersionsDocuments.fichesVisibles(ctx, [versionId])
    return visibles.length > 0
  },
}
