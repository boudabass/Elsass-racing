// Libellés français et couleurs des écrans de Voiture. Chaque état se lit en toutes lettres : la couleur
// n'est qu'un renfort (brief 3.3, section 2).

import type { VueGabarit } from "./gabarits/types"
import type { EtatPapiersVehicule, StatutEmplacement, StatutPapier } from "./regles"

export type TypeVehicule = "course" | "reco" | "assistance" | "remorque"
export type TypePapier = "passeport_technique" | "fiche_homologation" | "carte_grise" | "assurance" | "controle_technique" | "autre"

export const LIBELLE_TYPE_VEHICULE: Record<TypeVehicule, string> = {
  course: "Course",
  reco: "Reco",
  assistance: "Assistance",
  remorque: "Remorque",
}

export const LIBELLE_TYPE_PAPIER: Record<TypePapier, string> = {
  passeport_technique: "Passeport technique",
  fiche_homologation: "Fiche d'homologation",
  carte_grise: "Carte grise",
  assurance: "Assurance",
  controle_technique: "Contrôle technique",
  autre: "Autre",
}

// Libellé d'un papier : celui saisi pour « Autre », sinon le type.
export function libelleDuPapier(type: TypePapier, libelle: string | null): string {
  return type === "autre" && libelle ? libelle : LIBELLE_TYPE_PAPIER[type]
}

// Libellés des widgets de Voiture (brief 3.3, section 8). Affichés au lot 6.
export function libellePapiersARenouveler(nombre: number): string {
  if (nombre === 0) return "Aucun papier à renouveler"
  return nombre === 1 ? "1 papier à renouveler" : `${nombre} papiers à renouveler`
}

export function libelleEmplacementsLibres(nombre: number): string {
  if (nombre === 0) return "Aucun emplacement libre"
  return nombre === 1 ? "1 emplacement libre" : `${nombre} emplacements libres`
}

export const LIBELLE_CONDITIONS = { sec: "Sec", humide: "Humide", mixte: "Mixte", neige: "Neige" } as const
export const LIBELLE_REVETEMENT = { asphalte: "Asphalte", terre: "Terre", mixte: "Mixte" } as const

// Statut d'une ligne de papier (onglet Papiers).
export const LIBELLE_STATUT_PAPIER: Record<StatutPapier, string> = {
  valide: "Valide",
  a_renouveler: "À renouveler",
  expire: "Expiré",
}

export const COULEUR_STATUT_PAPIER: Record<StatutPapier, string> = {
  valide: "text-etat-ok",
  a_renouveler: "text-etat-orange",
  expire: "text-etat-rouge",
}

// État des papiers d'un véhicule (carte et en-tête de la fiche).
export const LIBELLE_ETAT_PAPIERS: Record<EtatPapiersVehicule, string> = {
  valide: "Papiers à jour",
  a_renouveler: "Papier à renouveler",
  expire: "Papier expiré",
  aucun: "Aucun papier",
}

export const COULEUR_ETAT_PAPIERS: Record<EtatPapiersVehicule, string> = {
  valide: "text-etat-ok",
  a_renouveler: "text-etat-orange",
  expire: "text-etat-rouge",
  aucun: "text-texte-discret",
}

// Statut d'un emplacement (onglet Déco).
export const LIBELLE_STATUT_EMPLACEMENT: Record<StatutEmplacement, string> = {
  libre: "Libre",
  reserve: "Réservé",
  occupe: "Occupé",
  indisponible: "Indisponible",
}

export const COULEUR_STATUT_EMPLACEMENT: Record<StatutEmplacement, string> = {
  libre: "text-texte",
  reserve: "text-etat-orange",
  occupe: "text-texte",
  indisponible: "text-texte-discret",
}

// Date civile (@db.Date lue en UTC à minuit) : « 3 novembre 2026 ».
const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export function dateEnToutesLettres(date: Date): string {
  return formatJour.format(date)
}

// Groupe et classe sur une ligne : « N2 · classe 11 », ou ce qui est renseigné.
export function groupeEtClasse(groupe: string | null, classe: string | null): string | null {
  if (groupe && classe) return `${groupe} · classe ${classe}`
  if (groupe) return groupe
  if (classe) return `classe ${classe}`
  return null
}

// Vue d'un emplacement : titre du groupe dans l'onglet Déco. La vue gauche n'a pas de groupe : ses emplacements
// sont les copies symétriques de la vue droite, indiquées par « (symétrique à gauche) ».
export const TITRE_VUE: Record<VueGabarit, string> = {
  droite: "Côté droit",
  gauche: "Côté gauche",
  avant: "Avant",
  arriere: "Arrière",
  dessus: "Dessus",
  hors_plan: "Autres emplacements",
}

// Nom d'un emplacement dans le choix d'une contrepartie : « Portière, côté gauche ». Le côté vient de la vue : un
// emplacement sans paire (capot, bandeau de pare-brise) garde son nom. Rien n'est stocké : le nom enregistré reste le même.
export function libelleEmplacementPourChoix(nom: string, vue: VueGabarit, symetrique: boolean): string {
  if (vue === "gauche") return `${nom}, côté gauche`
  if (vue === "droite" && symetrique) return `${nom}, côté droit`
  return nom
}

export const LIBELLE_STATUT_FINAL = {
  arrivee: "Arrivée",
  abandon: "Abandon",
  exclusion: "Exclusion",
  forfait: "Forfait",
} as const

// Kilomètres de spéciale : « 184,6 km de spéciale ».
export function kmDeSpeciale(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km de spéciale`
}

// Note de comportement : « 4/5 ».
export function noteSur5(note: number): string {
  return `${note}/5`
}

// Dimensions d'un emplacement : « 60 × 20 cm », ou rien si elles ne sont pas renseignées.
export function dimensionsDe(largeurCm: number | null, hauteurCm: number | null): string | null {
  return largeurCm && hauteurCm ? `${largeurCm} × ${hauteurCm} cm` : null
}

// Écart signé d'une comparaison : « +0,2 bar », « −1 mm ». Le signe est toujours écrit.
export function ecartSigne(ecart: number, unite: string): string {
  const signe = ecart > 0 ? "+" : ecart < 0 ? "−" : ""
  const valeur = Math.abs(ecart).toFixed(Number.isInteger(ecart) ? 0 : 1).replace(".", ",")
  return `${signe}${valeur}${unite ? ` ${unite}` : ""}`
}

// Valeur d'un champ de réglage en texte de formulaire : virgule décimale, comme à la saisie.
export function valeurEnTexte(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return ""
  return String(valeur).replace(".", ",")
}

// Pressions : toujours une décimale (« 2,0 bar »), à l'affichage, dans la comparaison et dans l'écart (brief 3.4).
// Les autres champs gardent leur affichage.
export function estPression(cle: string): boolean {
  return cle.startsWith("pression_")
}

export function valeurDeReglageEnTexte(cle: string, valeur: string | number | null | undefined): string {
  if (typeof valeur === "number" && estPression(cle)) return valeur.toFixed(1).replace(".", ",")
  return valeurEnTexte(valeur)
}

// Écart B − A d'un champ de réglage : une décimale pour les pressions.
export function ecartDeReglage(cle: string, ecart: number, unite: string): string {
  if (!estPression(cle)) return ecartSigne(ecart, unite)
  const signe = ecart > 0 ? "+" : ecart < 0 ? "−" : ""
  return `${signe}${Math.abs(ecart).toFixed(1).replace(".", ",")}${unite ? ` ${unite}` : ""}`
}
