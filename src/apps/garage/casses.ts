// Règles pures des fiches casse (tâche 4.4, brief §3, 954 §1 et §3). Sans accès base : les services sont dans casses-serveur.ts.

export const TYPES_CASSE = ["casse_mecanique", "sortie", "accident"] as const
export type TypeCasse = (typeof TYPES_CASSE)[number]

export function typeCasseValide(type: string): type is TypeCasse {
  return (TYPES_CASSE as readonly string[]).includes(type)
}

// Une fiche est « à compléter » tant qu'elle n'a pas de type ou pas d'organe touché (option A, décision de John du 24/10).
// Elle ne pousse rien sur le QG : c'est une information pour l'équipe.
export function ficheAComplter(fiche: { type: TypeCasse | null; organesTouches: number }): boolean {
  return fiche.type === null || fiche.organesTouches === 0
}

// Une pièce cassée était montée sur l'organe à la date de la casse si sa pose est antérieure ou égale, et sa dépose (si
// elle existe) postérieure ou égale.
export function montageALaDate(montage: { poseLe: Date; deposeeLe: Date | null }, date: Date): boolean {
  if (montage.poseLe.getTime() > date.getTime()) return false
  return montage.deposeeLe === null || montage.deposeeLe.getTime() >= date.getTime()
}
