// Règles pures des commandes du Garage (tâche 4.3, brief §5). Aucun accès base : les dates arrivent en « YYYY-MM-DD »
// (date de Paris pour aujourd'hui, date civile pour les livraisons), les calculs se font en jours entiers.

export const STATUTS_COMMANDE = ["commandee", "expediee", "recue"] as const
export type StatutCommande = (typeof STATUTS_COMMANDE)[number]

export const LIBELLE_STATUT_COMMANDE: Record<StatutCommande, string> = {
  commandee: "Commandée",
  expediee: "Expédiée",
  recue: "Reçue",
}

// Date civile YYYY-MM-DD, en jours depuis une origine fixe (sans fuseau, donc sans décalage d'été).
export function jourCivil(date: string): number {
  const [annee, mois, jour] = date.split("-").map(Number)
  return Math.round(Date.UTC(annee, mois - 1, jour) / 86_400_000)
}

// Date de Paris d'un instant, en YYYY-MM-DD : la référence de « en retard » et de la barre.
export function dateDeParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
}

// Barre d'une commande : part du temps écoulé entre la commande et la livraison prévue, de 0 à 100. Sans date prévue,
// la barre reste vide. Une livraison prévue le jour de la commande (ou avant) donne 100 dès le jour même.
export function avancementLivraison(commandeeLe: string, livraisonPrevueLe: string | null, aujourdhui: string): number {
  if (livraisonPrevueLe === null) return 0
  const debut = jourCivil(commandeeLe)
  const fin = jourCivil(livraisonPrevueLe)
  const ecoule = jourCivil(aujourdhui) - debut
  const total = fin - debut
  if (total <= 0) return jourCivil(aujourdhui) >= fin ? 100 : 0
  return Math.min(100, Math.max(0, Math.round((ecoule / total) * 100)))
}

// « En retard de N jours », en mots, quand la date prévue est passée. Null sinon.
export function libelleRetard(livraisonPrevueLe: string | null, aujourdhui: string): string | null {
  if (livraisonPrevueLe === null) return null
  const jours = jourCivil(aujourdhui) - jourCivil(livraisonPrevueLe)
  if (jours <= 0) return null
  return jours === 1 ? "En retard d'un jour" : `En retard de ${jours} jours`
}

// Tri des livraisons attendues : date prévue croissante, sans date en dernier.
export function comparerLivraisons(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

// Une seule réception par commande : la transition vers « recue » ne se fait qu'une fois.
export function receptionPossible(statut: StatutCommande): boolean {
  return statut !== "recue"
}
