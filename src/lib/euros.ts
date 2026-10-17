// Montants en centimes, en euros. Partagé par les apps (Budget, Saison) et le QG.

const formatEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

// Montant en centimes -> « 1 234,50 € ». Espace insécable de milliers, virgule décimale.
export function formatEuros(centimes: number): string {
  return formatEuro.format(centimes / 100)
}

// Centimes -> « 12,50 » pour un champ de saisie.
export function enEuros(centimes: number): string {
  return (centimes / 100).toFixed(2).replace(".", ",")
}
