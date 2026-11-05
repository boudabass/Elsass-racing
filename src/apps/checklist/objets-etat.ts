// État d'une échéance tel que Check-lists l'affiche pour un objet lié (tâche 5.7a). Pure : la date et le statut viennent
// des règles de l'app propriétaire. Le texte porte la date ; l'alerte passe en orange, jamais en rouge.

export type StatutEcheanceLie = "valide" | "a_renouveler" | "expire"

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export function dateLongue(date: Date): string {
  return FORMAT_DATE.format(date)
}

export function etatEcheance(statut: StatutEcheanceLie, fin: Date | null): { etat: string; alerte: boolean } {
  if (fin === null) return { etat: "Sans date de fin", alerte: false }
  if (statut === "expire") return { etat: `Expiré le ${dateLongue(fin)}`, alerte: true }
  if (statut === "a_renouveler") return { etat: `À renouveler, valable jusqu'au ${dateLongue(fin)}`, alerte: true }
  return { etat: `Valable jusqu'au ${dateLongue(fin)}`, alerte: false }
}

// Échéance d'une liste dans le contexte de son action de point critique (5.8, décision 2). Dite au jour de l'écriture :
// « le 29 octobre 2026 », « aujourd'hui », ou « dépassée depuis le 29 octobre 2026 ». Sans échéance : « non fixée ».
// Les deux dates sont « AAAA-MM-JJ », donc la comparaison de chaînes suit l'ordre des jours.
export function echeanceEnClair(echeance: string | null, aujourdhui: string): string {
  if (echeance === null) return "échéance non fixée"
  if (echeance === aujourdhui) return "échéance aujourd'hui"
  const date = dateLongue(new Date(`${echeance}T00:00:00Z`))
  return echeance > aujourdhui ? `échéance le ${date}` : `échéance dépassée depuis le ${date}`
}
