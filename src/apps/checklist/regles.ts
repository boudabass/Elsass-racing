// Règles pures de Check-lists (tâche 5.5a, brief section 3 et article 956 §4). Aucun accès à la base : ces fonctions
// reçoivent des points déjà lus et renvoient des valeurs, testées dans regles.test.ts. Les services (services-serveur.ts)
// les appellent à chaque changement, dans la même transaction, et écrivent le résultat dans checklist_list.
//
// Règles de jugement : jamais bloquant, jamais de rouge. Une liste incomplète reste informative.

export type StatutPoint = "a_faire" | "fait" | "sans_objet" | "probleme"
export type StatutListe = "a_faire" | "en_cours" | "terminee"
export type Zone = "vert" | "orange"
export type RoleCompte = "responsable" | "equipage" | "assistance" | "invite"
export type EcheanceRelative = "j_moins_7" | "j_moins_1" | "jour_j"

export interface PointRegle {
  statut: StatutPoint
  critique: boolean
}

// Seuil de la zone verte, en pourcentage. Une seule constante : réglable plus tard par la team, pas dans cette tâche.
export const SEUIL_ZONE_VERTE = 90
// Un point critique compte double dans l'avancement (956 §4).
export const POIDS_POINT_CRITIQUE = 2
// Un point critique ajouté à une liste dont l'échéance est à 7 jours ou moins est signalé (brief §5).
export const DELAI_POINT_CRITIQUE_JOURS = 7

const DECALAGE_JOURS: Record<EcheanceRelative, number> = { j_moins_7: 7, j_moins_1: 1, jour_j: 0 }

// ─── Avancement ──────────────────────────────────────────────────────────────

// Un point fait ou sans objet est avancé. Un point en problème compte comme non fait (956 §4).
function estAvance(point: PointRegle): boolean {
  return point.statut === "fait" || point.statut === "sans_objet"
}

function poids(point: PointRegle): number {
  return point.critique ? POIDS_POINT_CRITIQUE : 1
}

export function poidsTotal(points: PointRegle[]): number {
  return points.reduce((somme, point) => somme + poids(point), 0)
}

export function poidsAvance(points: PointRegle[]): number {
  return points.reduce((somme, point) => somme + (estAvance(point) ? poids(point) : 0), 0)
}

// Avancement entier de 0 à 100 (affichage). Liste vide : 0, sans erreur.
export function avancementPourcent(points: PointRegle[]): number {
  const total = poidsTotal(points)
  if (total === 0) return 0
  return Math.round((poidsAvance(points) * 100) / total)
}

// Points critiques encore ouverts : à faire ou en problème.
export function pointsCritiquesOuverts(points: PointRegle[]): PointRegle[] {
  return points.filter((point) => point.critique && (point.statut === "a_faire" || point.statut === "probleme"))
}

// ─── Zone ────────────────────────────────────────────────────────────────────

// Vert à partir du seuil, et seulement sans critique ouvert. Orange sinon. Jamais de rouge.
// Le calcul porte sur le ratio exact (entiers), pas sur l'avancement arrondi : 89,5 % reste orange.
export function zoneDeListe(points: PointRegle[]): Zone {
  const total = poidsTotal(points)
  if (total === 0) return "orange"
  const atteintSeuil = poidsAvance(points) * 100 >= SEUIL_ZONE_VERTE * total
  return atteintSeuil && pointsCritiquesOuverts(points).length === 0 ? "vert" : "orange"
}

// ─── Lien d'un point copié ───────────────────────────────────────────────────

// Un point copié dans une liste reprend le type de lien de son point de modèle, mais pas l'objet lié : le choix de
// l'objet (quel organe, quel papier) se fera en 5.7 (Liaisons). Sans objet posé, la fiche ne montre pas « Lié à ».
export function liensDuPointCopie<T extends string>(lienTypeDuModele: T): { lienType: T; lienId: null } {
  return { lienType: lienTypeDuModele, lienId: null }
}

// ─── Coche hors ligne (956 §4) ───────────────────────────────────────────────

// Une coche faite hors ligne porte l'heure de l'appareil. Au-delà de cette avance sur l'heure de réception, l'horloge
// de l'appareil est fausse : on prend l'heure de réception. Une seule constante, réglable plus tard.
export const MARGE_HEURE_FUTURE_MS = 5 * 60 * 1000

export interface DecisionCoche {
  // Heure retenue pour la coche (ramenée à la réception si l'appareil avance trop).
  heure: Date
  // Vrai : la coche devient le statut du point. Faux : elle reste dans l'historique, le statut ne bouge pas.
  gagne: boolean
}

// La coche la plus récente l'emporte, par son heure et non par son ordre d'arrivée. À égalité, la première arrivée au
// serveur garde le statut ; la seconde est gardée dans l'historique seulement.
export function decideCoche({ cocheStockee, cocheRecue, recuLe }: { cocheStockee: Date | null; cocheRecue: Date; recuLe: Date }): DecisionCoche {
  const heure = cocheRecue.getTime() - recuLe.getTime() > MARGE_HEURE_FUTURE_MS ? recuLe : cocheRecue
  const gagne = cocheStockee === null || heure.getTime() > cocheStockee.getTime()
  return { heure, gagne }
}

// ─── Statut de liste ─────────────────────────────────────────────────────────

// À faire : rien n'a encore avancé (ni fait ni sans objet). Terminée : tous les points sont faits ou sans objet,
// et la liste n'est pas vide. En cours sinon.
// Choix d'interprétation : un point sans objet est un point traité, donc il sort la liste de « à faire ».
export function statutDeListe(points: PointRegle[]): StatutListe {
  if (points.length === 0) return "a_faire"
  if (points.every(estAvance)) return "terminee"
  if (!points.some(estAvance)) return "a_faire"
  return "en_cours"
}

// Tout ce qui se calcule sur une liste, en une fois.
export function calculerListe(points: PointRegle[]): {
  avancement: number
  zone: Zone
  statut: StatutListe
  critiquesOuverts: number
} {
  return {
    avancement: avancementPourcent(points),
    zone: zoneDeListe(points),
    statut: statutDeListe(points),
    critiquesOuverts: pointsCritiquesOuverts(points).length,
  }
}

// ─── Dates ───────────────────────────────────────────────────────────────────

// Ajoute des jours à une date « AAAA-MM-JJ », en arithmétique UTC pour éviter tout décalage d'heure.
export function ajouterJours(jour: string, nombre: number): string {
  const [annee, mois, jourDuMois] = jour.split("-").map(Number)
  const date = new Date(Date.UTC(annee, mois - 1, jourDuMois + nombre))
  return date.toISOString().slice(0, 10)
}

// Jour calendaire de Paris d'un instant, « AAAA-MM-JJ ». Sert au « une fois par jour » et à l'échéance proche.
export function jourParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)
}

// Échéance d'une liste : la première échéance de ses points, c'est-à-dire la date de l'épreuve moins le plus grand
// décalage du modèle (J-7 avant J-1 avant jour J). Sans point à échéance relative : pas d'échéance (null), sans erreur.
export function echeanceDeListe(dateEpreuve: string, decalages: Array<EcheanceRelative | null>): string | null {
  const connus = decalages.filter((d): d is EcheanceRelative => d !== null)
  if (connus.length === 0) return null
  const plusGrand = Math.max(...connus.map((d) => DECALAGE_JOURS[d]))
  return ajouterJours(dateEpreuve, -plusGrand)
}

// Une échéance est proche si elle tombe dans les 7 jours (ou déjà passée). Sans échéance, jamais proche.
export function echeanceProche(echeance: string | null, aujourdhui: string): boolean {
  if (echeance === null) return false
  const restant = (Date.parse(echeance) - Date.parse(aujourdhui)) / 86_400_000
  return restant <= DELAI_POINT_CRITIQUE_JOURS
}

// L'épreuve a commencé quand la date du jour (Paris) n'est pas antérieure à sa date de début (Q5).
export function epreuveCommencee(dateDebut: string, aujourdhui: string): boolean {
  return aujourdhui >= dateDebut
}

// ─── Événements ──────────────────────────────────────────────────────────────

// checklist.probleme_signale : un point passe en problème (il n'y était pas déjà).
export function fautSignalerProbleme(ancien: StatutPoint | null, nouveau: StatutPoint): boolean {
  return nouveau === "probleme" && ancien !== "probleme"
}

// checklist.point_critique_ouvert : un point critique passe en problème, ou un point critique est ajouté à une liste
// dont l'échéance est à 7 jours ou moins.
export function fautSignalerPointCritique(
  changement: { ancien: StatutPoint | null; nouveau: StatutPoint; critique: boolean; ajoute: boolean },
  echeance: string | null,
  aujourdhui: string,
): boolean {
  if (!changement.critique) return false
  if (fautSignalerProbleme(changement.ancien, changement.nouveau)) return true
  return changement.ajoute && echeanceProche(echeance, aujourdhui)
}

// checklist.liste_terminee : une fois par liste et par jour calendaire (Paris) (Q3). joursDejaEmis : les jours
// (Paris) des événements déjà émis pour cette liste, lus dans core_domain_event.
export function listeTermineeAEmettre(joursDejaEmis: string[], aujourdhui: string): boolean {
  return !joursDejaEmis.includes(aujourdhui)
}

// ─── Discipline ──────────────────────────────────────────────────────────────

// Correspondance entre le type d'épreuve du socle (CoreEventType) et la discipline des modèles (docs/schema-checklist.md, Q1).
// expo, roulage et autre n'ont pas de discipline : seuls les modèles transversaux s'y appliquent. circuit n'a pas
// d'épreuve correspondante dans le socle pour l'instant.
export function disciplineDeType(type: string): "rallye" | "course_de_cote" | "slalom" | null {
  if (type === "rallye") return "rallye"
  if (type === "course_de_cote") return "course_de_cote"
  if (type === "slalom") return "slalom"
  return null
}

// ─── Droits ──────────────────────────────────────────────────────────────────

// Les modèles ne sont pas visibles par l'assistance, ni par l'invité (956 §6).
export function modelesVisiblesPour(role: RoleCompte): boolean {
  return role === "responsable" || role === "equipage"
}

// L'assistance ne voit que les listes ouvertes à elle. L'équipage et le responsable voient toutes les listes de l'épreuve.
export function listeVisiblePour(role: RoleCompte, liste: { ouverteAssistance: boolean }): boolean {
  if (role === "responsable" || role === "equipage") return true
  if (role === "assistance") return liste.ouverteAssistance
  return false
}

export type ActionSurPoint = "cocher" | "annoter" | "ajouter" | "modifier" | "retirer"

export type DecisionAssistance = { autorise: true } | { autorise: false; raison: string }

// Droits de l'assistance sur un point (956 §6, brief §1). Cocher et annoter : tout point d'une liste ouverte.
// Ajouter : un point de plus dans une liste ouverte. Modifier et retirer : seulement les points qu'elle a créés.
export function assistancePeut(
  action: ActionSurPoint,
  liste: { ouverteAssistance: boolean },
  point: { creePar: string | null } | null,
  compte: string,
): DecisionAssistance {
  if (!liste.ouverteAssistance) return { autorise: false, raison: "Cette liste n'est pas ouverte à l'assistance." }
  if (action === "modifier" || action === "retirer") {
    if (point === null || point.creePar !== compte) {
      return { autorise: false, raison: "Tu ne peux modifier ou retirer que les points que tu as ajoutés." }
    }
  }
  return { autorise: true }
}

// ─── Réassignation (settings.membre_retire) ──────────────────────────────────

// Un point « en attente » est à faire ou en problème. Un point fait ou sans objet ne compte pas (décision de l'orchestrateur, 01/11).
export function pointEnAttente(statut: StatutPoint): boolean {
  return statut === "a_faire" || statut === "probleme"
}

// Une action de réassignation est proposée quand la personne retirée a au moins un point en attente.
export function doitProposerReassignation(statuts: StatutPoint[]): boolean {
  return statuts.some(pointEnAttente)
}

// L'action est levée quand plus aucun point en attente ne lui est affecté.
export function reassignationLevee(pointsEnAttente: number): boolean {
  return pointsEnAttente === 0
}

// ─── Phase en cours d'une épreuve (5.6, §1.5, décision de l'orchestrateur du 01/11) ─────
// Aucune colonne ni table : la phase se lit dans les listes. Ordre fixé par 956 §1.

export type PhaseEpreuve = "avant_depart" | "verifications" | "reconnaissances" | "epreuve" | "retour"

export const ORDRE_PHASES: readonly PhaseEpreuve[] = ["avant_depart", "verifications", "reconnaissances", "epreuve", "retour"]

export interface ListePhasee {
  id: string
  phase: PhaseEpreuve
  points: Array<PointRegle & { id: string }>
}

// Une liste est « entamée » dès qu'un de ses points n'est plus à faire (fait, sans objet ou problème).
function listeEntamee(liste: ListePhasee): boolean {
  return liste.points.some((point) => point.statut !== "a_faire")
}

// La phase la plus avancée parmi les listes entamées ; aucune liste entamée = avant départ.
export function phaseEnCours(listes: readonly ListePhasee[]): PhaseEpreuve {
  let indice = 0
  for (const liste of listes) {
    if (!listeEntamee(liste)) continue
    indice = Math.max(indice, ORDRE_PHASES.indexOf(liste.phase))
  }
  return ORDRE_PHASES[indice]
}

// Points critiques encore ouverts (à faire ou en problème) dans les phases strictement avant la phase ouverte.
// Vide si la liste ouverte n'est pas postérieure à la phase en cours : rien à avertir.
export function avertissementAvantPhase(
  phaseOuverte: PhaseEpreuve,
  listes: readonly ListePhasee[],
): Array<{ listeId: string; pointId: string }> {
  const enCours = phaseEnCours(listes)
  if (ORDRE_PHASES.indexOf(phaseOuverte) <= ORDRE_PHASES.indexOf(enCours)) return []
  const rang = ORDRE_PHASES.indexOf(phaseOuverte)
  const ouverts: Array<{ listeId: string; pointId: string }> = []
  for (const liste of listes) {
    if (ORDRE_PHASES.indexOf(liste.phase) >= rang) continue
    for (const point of liste.points) {
      if (point.critique && pointEnAttente(point.statut)) ouverts.push({ listeId: liste.id, pointId: point.id })
    }
  }
  return ouverts
}

// Action « point critique » (5.7a) : un point critique à faire ou en problème, dans une liste à 7 jours ou moins de son
// échéance, figure dans la boîte. Une liste sans échéance n'en a pas.
export function actionPointCritiqueDue(point: { critique: boolean; statut: StatutPoint }, echeance: string | null, aujourdhui: string): boolean {
  return point.critique && (point.statut === "a_faire" || point.statut === "probleme") && echeanceProche(echeance, aujourdhui)
}

// L'action se lève quand le point est fait ou sans objet. Le retrait d'un point se traite à part (services-serveur).
export function actionPointCritiqueLevee(statut: StatutPoint): boolean {
  return statut === "fait" || statut === "sans_objet"
}

// Rattrapage du QG (5.7a) : parmi les points dont une action est en attente, ceux qu'elle ne concerne plus. Un point
// qui n'est plus due (fait, plus critique, liste sans échéance ou repoussée hors des 7 jours) doit lever son action,
// même sans aucun changement de point : c'est le seul passage du temps qui l'a rendu caduque.
export function pointsActionADeLever(
  points: Array<{ id: string; critique: boolean; statut: StatutPoint; echeance: string | null }>,
  aujourdhui: string,
): string[] {
  return points.filter((point) => !actionPointCritiqueDue({ critique: point.critique, statut: point.statut }, point.echeance, aujourdhui)).map((point) => point.id)
}
