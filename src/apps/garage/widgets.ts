// Widgets du Garage : résumés purs, testés. Les lectures en base sont dans widgets-serveur.ts.
// Pas d'affichage ici : le Tableau de bord arrive au lot 6 (comme pour Saison).

import { dateAtelier, libelleZone, pourcentage, zoneIndice } from "./mise-en-forme"

// Fiabilité d'une voiture : le mot de la zone, puis le pourcentage. Null : pas encore suivi (atelier non préparé).
export function libelleFiabilite(indice: number | null): string {
  if (indice === null) return "Pas encore suivi"
  return `${libelleZone(zoneIndice(indice))} · ${pourcentage(indice)}`
}

// Organes en zone rouge avant la prochaine épreuve, et après si l'estimation existe (null sans épreuve engagée).
export function libelleZonesRouges(maintenant: number, apres: number | null): string {
  const compte = (n: number) => (n === 1 ? "1 organe en zone rouge" : `${n} organes en zone rouge`)
  const actuel = maintenant === 0 ? "Aucun organe en zone rouge" : compte(maintenant)
  if (apres === null) return actuel
  return `${actuel} · ${apres} après l'épreuve`
}

export function libelleTravaux(enCours: number, prevus: number): string {
  return `${enCours} en cours · ${prevus} prévu${prevus > 1 ? "s" : ""}`
}

export function libelleLivraisons(nombre: number, prochaine: Date | null): string {
  if (nombre === 0) return "Aucune livraison attendue"
  const attendues = `${nombre} attendue${nombre > 1 ? "s" : ""}`
  return prochaine ? `${attendues} · prochaine le ${dateAtelier(prochaine)}` : attendues
}
