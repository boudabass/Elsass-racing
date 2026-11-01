// Règles pures des tâches du socle (core_task), créées sur un événement d'une app (tâche 5.7a, article 956 §5).
// Sans I/O : testables sans base.

// Titre d'une tâche de problème : le libellé du point et sa liste. Sans libellé (événement ancien), un titre générique.
export function libelleTacheProbleme(libelle: string | null | undefined, listeTitre: string | null | undefined): string {
  const titre = libelle ? `Problème : ${libelle}` : "Problème signalé"
  return listeTitre ? `${titre} (${listeTitre})` : titre
}

// Un point lié à un organe est traité par Garage (proposition d'ordre de travail) : il n'ouvre pas de tâche du socle.
export function pointTraiteParGarage(lienType: string | null, lienId: string | null): boolean {
  return lienType === "organe_garage" && lienId !== null
}
