// Affichage des écrans de Partenaires (brief 3.6, §2 à §7) : libellés, écarts de relance, tri et compte de la
// Prospection. Fonctions pures, sans base ni serveur : elles servent aux pages et aux composants.

import type { StatutContrepartie, StatutConvention, StatutPartenaire } from "./regles"

export const STATUTS_PARTENAIRE: readonly StatutPartenaire[] = [
  "a_contacter",
  "contacte",
  "relance",
  "interesse",
  "partenaire",
  "ancien_partenaire",
  "refus",
]

// Statuts que l'on choisit à la main (le service refuse les deux autres : ils sont automatiques).
export const STATUTS_SAISIS: readonly StatutPartenaire[] = ["a_contacter", "contacte", "relance", "interesse", "refus"]

// Colonnes de la vue en colonnes : « Refus » et « Ancien partenaire » sont repliées en bas.
export const STATUTS_COLONNES: readonly StatutPartenaire[] = ["a_contacter", "contacte", "relance", "interesse", "partenaire"]
export const STATUTS_REPLIES: readonly StatutPartenaire[] = ["ancien_partenaire", "refus"]

export const LIBELLES_STATUT_PARTENAIRE: Record<StatutPartenaire, string> = {
  a_contacter: "À contacter",
  contacte: "Contacté",
  relance: "Relance",
  interesse: "Intéressé",
  partenaire: "Partenaire",
  ancien_partenaire: "Ancien partenaire",
  refus: "Refus",
}

// Le statut se lit d'abord dans le mot. La couleur n'ajoute qu'un repère (pastille).
export const COULEUR_STATUT_PARTENAIRE: Record<StatutPartenaire, string> = {
  a_contacter: "bg-surface-2 text-texte",
  contacte: "bg-surface-2 text-texte",
  relance: "bg-etat-orange/20 text-texte",
  interesse: "bg-marque/15 text-texte",
  partenaire: "bg-etat-ok/20 text-texte",
  ancien_partenaire: "bg-surface-2 text-texte-discret",
  refus: "bg-surface-2 text-texte-discret",
}

export const LIBELLES_STATUT_CONVENTION: Record<StatutConvention, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  signee: "Signée",
  en_cours: "En cours",
  terminee: "Terminée",
  resiliee: "Résiliée",
}

// Apport reçu (brief 3.8, §7) : calculé à chaque recette encaissée de la convention.
export const LIBELLES_APPORT_RECU: Record<"non" | "partiel" | "oui", string> = {
  non: "Apport non reçu",
  partiel: "Apport partiel",
  oui: "Apport reçu",
}

export const LIBELLES_STATUT_CONTREPARTIE: Record<StatutContrepartie | "en_retard", string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  tenue: "Tenue",
  reportee: "Reportée",
  en_retard: "En retard",
}

export const LIBELLES_TYPE_CONTREPARTIE: Record<string, string> = {
  logo_voiture: "Logo sur la voiture",
  publication_reseaux: "Publications sur les réseaux",
  story: "Story",
  presence_exposition: "Présence à une exposition",
  logo_tenues: "Logo sur les tenues",
  mention_dossier: "Mention dans le dossier",
  photo_dediee: "Photo dédiée",
  invitation_epreuve: "Invitation à une épreuve",
  autre: "Autre",
}

export const LIBELLES_TYPE_INTERACTION: Record<string, string> = {
  appel: "Appel",
  mail: "Mail",
  rencontre: "Rencontre",
  courrier: "Courrier",
  autre: "Autre",
}

export const LIBELLES_SOURCE: Record<string, string> = {
  reseau: "Réseau",
  demarchage: "Démarchage",
  recommandation: "Recommandation",
  autre: "Autre",
}

export const LIBELLES_TYPE_PREUVE: Record<string, string> = {
  photo: "Photo",
  lien: "Lien",
  capture: "Capture",
}

export const LIBELLES_STATUT_RESULTAT: Record<string, string> = {
  arrivee: "Arrivée",
  abandon: "Abandon",
  exclusion: "Exclusion",
  forfait: "Forfait",
}

// Nombre de jours entre deux jours civils « AAAA-MM-JJ » (positif si b est après a).
export function ecartJours(a: string, b: string): number {
  const debut = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)))
  const fin = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)))
  return Math.round((fin - debut) / 86_400_000)
}

function pluriel(nombre: number): string {
  return nombre > 1 ? `${nombre} jours` : `${nombre} jour`
}

// Écart à la prochaine relance : « en retard de 2 jours » (rouge), « aujourd'hui » (orange), « dans 3 jours ».
export function ecartRelance(relance: string | null, aujourdhui: string): { libelle: string; ton: "retard" | "aujourdhui" | "avenir" } | null {
  if (!relance) return null
  const ecart = ecartJours(aujourdhui, relance)
  if (ecart < 0) return { libelle: `en retard de ${pluriel(-ecart)}`, ton: "retard" }
  if (ecart === 0) return { libelle: "aujourd'hui", ton: "aujourdhui" }
  return { libelle: `dans ${pluriel(ecart)}`, ton: "avenir" }
}

export const CLASSE_TON_RELANCE: Record<"retard" | "aujourdhui" | "avenir", string> = {
  retard: "font-medium text-etat-rouge",
  aujourdhui: "font-medium text-etat-orange",
  avenir: "text-texte-discret",
}

// Tri de la Prospection : relances en retard (les plus anciennes d'abord), puis relances à venir par date,
// puis les autres par nom.
export function trierProspection<T extends { entreprise: string; prochaineRelance: string | null }>(liste: T[], aujourdhui: string): T[] {
  const retards = liste.filter((p) => p.prochaineRelance !== null && p.prochaineRelance < aujourdhui)
  const avenir = liste.filter((p) => p.prochaineRelance !== null && p.prochaineRelance >= aujourdhui)
  const autres = liste.filter((p) => p.prochaineRelance === null)
  const parDate = (a: T, b: T) => (a.prochaineRelance ?? "").localeCompare(b.prochaineRelance ?? "")
  const parNom = (a: T, b: T) => a.entreprise.localeCompare(b.entreprise, "fr")
  return [...retards.sort(parDate), ...avenir.sort(parDate), ...autres.sort(parNom)]
}

// Compte par statut, pour les pastilles de filtre. « total » compte toutes les fiches.
export function compterParStatut(liste: { statut: StatutPartenaire }[]): Record<StatutPartenaire | "total", number> {
  const compte = { total: liste.length } as Record<StatutPartenaire | "total", number>
  for (const statut of STATUTS_PARTENAIRE) compte[statut] = 0
  for (const partenaire of liste) compte[partenaire.statut] += 1
  return compte
}

// Lit le filtre de l'URL : seul un statut connu est accepté, sinon « Tous ».
export function filtreStatut(valeur: string | undefined): StatutPartenaire | null {
  return STATUTS_PARTENAIRE.find((statut) => statut === valeur) ?? null
}

// « 2026-10-18 » → « 18/10/2026 » (jour civil, sans fuseau).
export function dateFrancaise(jour: string | null): string {
  if (!jour) return ""
  const [annee, mois, date] = jour.split("-")
  return `${date}/${mois}/${annee}`
}

// Instant (messages, dernière consultation) affiché en heure de Paris, pour que serveur et navigateur écrivent pareil.
const FORMAT_INSTANT = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

export function instantFrancais(instant: Date | null): string {
  return instant ? FORMAT_INSTANT.format(instant) : ""
}

// Montant saisi en euros (« 1 500 », « 1500,50 ») → centimes. Vide : zéro. Invalide ou négatif : null.
export function centimesDeSaisie(saisie: string): number | null {
  const propre = saisie.replace(/\s/g, "").replace(",", ".")
  if (propre === "") return 0
  const euros = Number(propre)
  if (!Number.isFinite(euros) || euros < 0) return null
  return Math.round(euros * 100)
}

// Statuts d'emplacement de la voiture, écrits comme dans le plan de déco (lus ici, pas importés de Voiture).
export const LIBELLE_EMPLACEMENT: Record<string, string> = {
  libre: "libre",
  reserve: "réservé",
  occupe: "occupé",
  indisponible: "indisponible",
}

// Une contrepartie à faire, dont l'échéance tombe dans les 14 jours, passe en orange ; en retard, en rouge.
export const ECHEANCE_PROCHE_JOURS = 14

// Le mot de statut : rouge en retard (texte rouge sur fond clair ; etat-rouge-texte est blanc, pour un fond rouge).
export function couleurContrepartie(statut: "a_faire" | "en_cours" | "tenue" | "reportee" | "en_retard", echeance: string | null, aujourdhui: string): string {
  if (statut === "en_retard") return "font-medium text-etat-rouge"
  if (statut === "tenue") return "text-etat-ok"
  if ((statut === "a_faire" || statut === "en_cours") && echeance && ecartJours(aujourdhui, echeance) <= ECHEANCE_PROCHE_JOURS) return "text-etat-orange"
  return "text-texte"
}

// La barre d'avancement : verte quand c'est tenu, orange quand l'échéance approche, rouge en retard, grise sinon.
// Jamais la couleur de marque (brief 3.7, point 0).
export function couleurBarreContrepartie(statut: "a_faire" | "en_cours" | "tenue" | "reportee" | "en_retard", echeance: string | null, aujourdhui: string): string {
  if (statut === "en_retard") return "bg-etat-rouge"
  if (statut === "tenue") return "bg-etat-ok"
  if ((statut === "a_faire" || statut === "en_cours") && echeance && ecartJours(aujourdhui, echeance) <= ECHEANCE_PROCHE_JOURS) return "bg-etat-orange"
  return "bg-texte-discret"
}
