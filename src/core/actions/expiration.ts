// Expiration d'une action à échéance : 30 jours après sa date, l'action sort de la boîte (actions-serveur.ts, lecture).
// Pur : aucun accès base. Une action sans échéance n'expire jamais (c'est le cas des obligations, priorites.ts).

export const DELAI_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000

// En dessous de cette date, une échéance est expirée. Strictement avant : une échéance à exactement 30 jours reste.
export function limiteExpiration(maintenant: Date): Date {
  return new Date(maintenant.getTime() - DELAI_EXPIRATION_MS)
}

export function estExpiree(echeance: Date | null, maintenant: Date): boolean {
  return echeance !== null && echeance.getTime() < limiteExpiration(maintenant).getTime()
}
