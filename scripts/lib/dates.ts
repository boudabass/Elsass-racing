// Dates relatives des scripts de vérification : jours civils de Paris, jamais « ± n × 86 400 000 ms ». Entre deux dates
// de Paris, le changement d'heure rend une journée de 23 ou 25 heures : la soustraction en millisecondes tombe alors sur
// le mauvais jour. Même calcul que e2e/aide/dates.ts.
import { jourDeParis } from "../../src/core/dates"

// Jour civil « AAAA-MM-JJ », décalé de `decalage` jours à partir du jour de Paris de `maintenant`.
export function jourParis(decalage: number, maintenant: Date = new Date()): string {
  const [annee, mois, jour] = jourDeParis(maintenant).split("-").map(Number)
  return new Date(Date.UTC(annee, mois - 1, jour + decalage)).toISOString().slice(0, 10)
}
