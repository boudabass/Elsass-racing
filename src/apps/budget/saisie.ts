// Lecture d'un montant saisi en euros (« 12,50 », « 1 234,5 », « 1234.50 ») vers des centimes entiers.
// Renvoie null si la saisie n'est pas un montant positif ou nul : le formulaire le dit en clair.

export function montantSaisi(texte: string): number | null {
  const nettoye = texte.replace(/[\s  ]/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(nettoye)) return null
  const centimes = Math.round(Number(nettoye) * 100)
  return Number.isSafeInteger(centimes) ? centimes : null
}
