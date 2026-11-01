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
