// Conflit d'écriture ou interblocage (P2034) : Prisma demande de recommencer l'opération. Reprise bornée :
// trois essais au total, et seulement pour ce code. Toute autre erreur remonte tout de suite.
// Hors de prisma.ts : le module n'ouvre pas de connexion, donc il se teste sans base.
export const ESSAIS_CONFLIT = 3

export function estConflitEcriture(erreur: unknown): boolean {
  return typeof erreur === "object" && erreur !== null && (erreur as { code?: unknown }).code === "P2034"
}

export async function avecReprisePourConflit<T>(operation: () => Promise<T>): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await operation()
    } catch (erreur) {
      if (essai >= ESSAIS_CONFLIT || !estConflitEcriture(erreur)) throw erreur
    }
  }
}
