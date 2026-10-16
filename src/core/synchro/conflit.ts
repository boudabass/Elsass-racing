// Règles de conflit de la synchro : la dernière écriture gagne, sans perte silencieuse.
// Une écriture envoie la rev qu'elle a lue. Si la ligne serveur a changé depuis, l'écriture est
// appliquée quand même, et la version écrasée est journalisée. Une suppression l'emporte.

export type DecisionModification = "appliquer" | "appliquer_et_journaliser" | "supprimee_gagne"

export interface EtatLigne {
  revLue: number
  revServeur: number
  supprimee: boolean
}

// Modification : si la ligne est supprimée, la suppression gagne. Si la rev a bougé, on applique et on
// journalise. Sinon, on applique simplement.
export function decideModification({ revLue, revServeur, supprimee }: EtatLigne): DecisionModification {
  if (supprimee) return "supprimee_gagne"
  return revLue === revServeur ? "appliquer" : "appliquer_et_journaliser"
}

export type DecisionSuppression = "deja_supprimee" | "supprimer" | "supprimer_et_journaliser"

// Suppression : une ligne déjà supprimée reste telle quelle (rejouer ne fait rien). Sinon on supprime,
// et on journalise si la rev a bougé entre-temps (la version concurrente est remplacée).
export function decideSuppression({ revLue, revServeur, supprimee }: EtatLigne): DecisionSuppression {
  if (supprimee) return "deja_supprimee"
  return revLue === revServeur ? "supprimer" : "supprimer_et_journaliser"
}
