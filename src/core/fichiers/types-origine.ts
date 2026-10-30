// Types du registre des origines de fichiers (tâche 5.4, « Tous les fichiers »). À part du registre, pour que les apps
// puissent déclarer leur origine sans importer le registre (pas de cycle).
import type { ContexteTeam } from "@/core/contexte"

// La fiche d'où vient un fichier, telle que la vue unifiée l'affiche : libellé et chemin dans son app.
export interface FicheOrigine {
  id: string
  libelle: string
  chemin: string
}

export interface OrigineFichier {
  app: string
  ficheType: string
  // Pourquoi un type est masqué, pour un type déclaré mais non affiché en 5.4 (dit dans docs/schema-documents.md).
  // Absent quand le type est affiché.
  masque?: string
  // Fiches visibles par la personne parmi les identifiants donnés. Une fiche absente du résultat n'est pas montrée.
  // La lecture sur l'app d'origine est contrôlée ici, comme la règle de visibilité de la fiche elle-même.
  fichesVisibles(ctx: ContexteTeam, ids: readonly string[]): Promise<FicheOrigine[]>
}
