// Règles pures du registre des origines (tâche 5.4). Sans import de base ni d'app : la liste des origines est passée en
// paramètre, ce qui permet de les tester sans DATABASE_URL. Le registre (origines.ts) fournit la liste déclarée.
import type { OrigineFichier } from "./types-origine"

export interface RattachementFichier {
  app: string
  ficheType: string
  ficheId: string
}

export function origineDeclaree(origines: readonly OrigineFichier[], app: string, ficheType: string): OrigineFichier | null {
  return origines.find((origine) => origine.app === app && origine.ficheType === ficheType) ?? null
}

// Regroupe les rattachements par origine déclarée. Un type non déclaré n'entre dans aucun groupe : il n'est pas affiché.
export function grouperParOrigine(origines: readonly OrigineFichier[], rattachements: readonly RattachementFichier[]): Map<OrigineFichier, string[]> {
  const groupes = new Map<OrigineFichier, string[]>()
  for (const rattachement of rattachements) {
    const origine = origineDeclaree(origines, rattachement.app, rattachement.ficheType)
    if (!origine) continue
    const ids = groupes.get(origine) ?? []
    ids.push(rattachement.ficheId)
    groupes.set(origine, ids)
  }
  return groupes
}
