// Attente entre deux tentatives de synchro après un échec réseau : croissante, plafonnée. Jamais de
// boucle serrée. Un échec n = 1 attend 2 s, puis 4 s, 8 s… jusqu'à une minute.

const BASE_MS = 1000
const PLAFOND_MS = 60_000

export function delaiAvantNouvelEssai(echecs: number): number {
  const exposant = Math.min(Math.max(echecs, 1), 6)
  return Math.min(PLAFOND_MS, BASE_MS * 2 ** exposant)
}
