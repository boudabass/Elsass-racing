// Check-lists dans la préparation de Saison (tâche 5.7a, 956 §5) : par engagement, l'avancement et les points critiques
// ouverts, à titre d'information, hors indice. Lecture seule. Rien n'est copié chez Saison : tout se lit à l'affichage.
import { checklistActivee, resumeChecklistEngagement, type ResumeChecklistEngagement } from "@/apps/checklist/lectures-partagees"
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"

export interface ChecklistPreparation {
  // Faux si Check-lists n'est pas activée, ou si le membre n'y a pas accès : la ligne ne s'affiche pas.
  active: boolean
  parEngagement: Map<string, ResumeChecklistEngagement | null>
}

export async function lirePreparationChecklist(ctx: ContexteTeam, entryIds: readonly string[]): Promise<ChecklistPreparation> {
  const parEngagement = new Map<string, ResumeChecklistEngagement | null>()
  const visible = (await checklistActivee(ctx)) && (await niveauDe(ctx, "checklist")) !== "aucun"
  if (!visible) {
    for (const id of entryIds) parEngagement.set(id, null)
    return { active: false, parEngagement }
  }
  for (const id of entryIds) parEngagement.set(id, await resumeChecklistEngagement(ctx, id))
  return { active: true, parEngagement }
}
