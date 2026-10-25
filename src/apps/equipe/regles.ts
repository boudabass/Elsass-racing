// Règles pures d'Équipe (tâche 5.1, brief section 3). Aucun accès à la base : ces fonctions reçoivent des données
// déjà lues et renvoient des décisions, testées dans regles.test.ts.
//
// Les statistiques ne comptent que les résultats validés : les lectures (lectures-serveur.ts) ne passent que ceux-là.

import { statutPapier, type StatutPapier } from "@/apps/voiture/regles"

// ─── Échéances : licences et équipements ─────────────────────────────────────

// Même règle que les papiers de Voiture (30 jours ou moins, comme le brief le demande) : une seule source.
export type StatutEcheance = StatutPapier

// Licence : sa validité est « valable_au ». Sans date de fin, pas d'expiration.
export function statutLicence(valableAu: Date | null, maintenant: Date): StatutEcheance {
  return statutPapier(valableAu, maintenant)
}

// Équipement : sa fin d'homologation. Sans date, pas d'expiration.
export function statutEquipement(finHomologation: Date | null, maintenant: Date): StatutEcheance {
  return statutPapier(finHomologation, maintenant)
}

// ─── Paliers d'expérience ────────────────────────────────────────────────────

// Seuils du nombre d'épreuves, identiques pour toutes les teams (955 §4). Décision de John du 25/10 : sur les
// épreuves seules, jamais de descente.
export const PALIERS = ["rookie", "confirme", "experimente", "veteran", "figure"] as const
export type Palier = (typeof PALIERS)[number]

export const SEUIL_PALIER: Record<Palier, number> = {
  rookie: 0,
  confirme: 5,
  experimente: 15,
  veteran: 30,
  figure: 60,
}

function rang(palier: Palier): number {
  return PALIERS.indexOf(palier)
}

// Palier calculé à partir du nombre d'épreuves, mais jamais en dessous du palier déjà atteint (gardé dans equipe_profile).
export function palierDepuis(nombreEpreuves: number, palierAtteint: Palier): Palier {
  let calcule: Palier = "rookie"
  for (const palier of PALIERS) {
    if (nombreEpreuves >= SEUIL_PALIER[palier]) calcule = palier
  }
  return rang(calcule) >= rang(palierAtteint) ? calcule : palierAtteint
}

// Épreuves d'assistance : celles où la personne était affectée ET a répondu « vient ». Les deux listes sont des
// identifiants d'épreuve, sans doublon compté deux fois.
export function epreuvesAssistance(affectees: string[], venues: string[]): number {
  const venue = new Set(venues)
  return new Set(affectees.filter((epreuve) => venue.has(epreuve))).size
}

// ─── Statistiques officielles ────────────────────────────────────────────────

export type StatutFinal = "arrivee" | "abandon" | "exclusion" | "forfait"

// Un résultat validé, tel que lu chez Saison (lecture partagée) : rien d'autre n'entre dans les calculs.
export interface ResultatValide {
  statutFinal: StatutFinal
  classementGeneral: number | null
  classementClasse: number | null
  kmSpeciale: number
}

export interface StatistiquesPersonne {
  epreuves: number
  arrivees: number
  // Part des épreuves terminées à l'arrivée, entre 0 et 1 ; null sans épreuve.
  tauxArrivee: number | null
  kmChronometres: number
  // Meilleur classement de classe parmi les arrivées ; null sans arrivée classée.
  meilleurClassement: number | null
}

export function statistiquesPersonne(resultats: ResultatValide[]): StatistiquesPersonne {
  const arrivees = resultats.filter((r) => r.statutFinal === "arrivee")
  const classements = arrivees.map((r) => r.classementClasse).filter((c): c is number => c !== null)
  return {
    epreuves: resultats.length,
    arrivees: arrivees.length,
    tauxArrivee: resultats.length === 0 ? null : arrivees.length / resultats.length,
    kmChronometres: resultats.reduce((total, r) => total + r.kmSpeciale, 0),
    meilleurClassement: classements.length === 0 ? null : Math.min(...classements),
  }
}

export interface StatistiquesBinome {
  epreuvesCommunes: number
  kmEnsemble: number
  arriveesEnsemble: number
  // Meilleur classement général ensemble parmi les arrivées ; null sans arrivée classée.
  meilleurResultat: number | null
}

// Binôme pilote et copilote : les résultats sont ceux des engagements où les deux étaient inscrits.
export function statistiquesBinome(resultats: ResultatValide[]): StatistiquesBinome {
  const arrivees = resultats.filter((r) => r.statutFinal === "arrivee")
  const classements = arrivees.map((r) => r.classementGeneral).filter((c): c is number => c !== null)
  return {
    epreuvesCommunes: resultats.length,
    kmEnsemble: resultats.reduce((total, r) => total + r.kmSpeciale, 0),
    arriveesEnsemble: arrivees.length,
    meilleurResultat: classements.length === 0 ? null : Math.min(...classements),
  }
}

// ─── Ressenti ────────────────────────────────────────────────────────────────

// Nombre de débriefs pris en compte pour le ressenti moyen affiché sur la fiche.
export const NOMBRE_RESSENTIS_MOYENNE = 5

// Ressenti moyen des derniers débriefs, sur une échelle de 1 à 5, arrondi au dixième. Les ressentis sont
// donnés du plus récent au plus ancien ; seuls les NOMBRE_RESSENTIS_MOYENNE premiers comptent. Sans ressenti : null.
export function ressentiMoyen(ressentis: number[]): number | null {
  const derniers = ressentis.slice(0, NOMBRE_RESSENTIS_MOYENNE)
  if (derniers.length === 0) return null
  const moyenne = derniers.reduce((total, r) => total + r, 0) / derniers.length
  return Math.round(moyenne * 10) / 10
}

// ─── Saisie : cohérence des dates ────────────────────────────────────────────

// « AAAA-MM-JJ » se compare comme du texte. Une validité sans début ou sans fin reste cohérente.
export function validiteCoherente(valableDu: string | null | undefined, valableAu: string | null | undefined): boolean {
  if (!valableDu || !valableAu) return true
  return valableAu >= valableDu
}

// ─── Listes fermées (955 §3). Identiques aux enums de prisma/schema.prisma et de la migration equipe_schema. ─

export const ROLES_HABITUELS = ["pilote", "copilote", "assistance", "benevole"] as const
export type RoleHabituel = (typeof ROLES_HABITUELS)[number]

export const TYPES_LICENCE = ["ffsa_regionale", "ffsa_nationale", "ffsa_internationale", "autre"] as const
export type TypeLicence = (typeof TYPES_LICENCE)[number]

export const LIBELLES_TYPE_LICENCE: Record<TypeLicence, string> = {
  ffsa_regionale: "Licence FFSA régionale",
  ffsa_nationale: "Licence FFSA nationale",
  ffsa_internationale: "Licence FFSA internationale",
  autre: "Licence",
}

export const TYPES_EQUIPEMENT = ["casque", "hans", "combinaison", "gants", "bottines", "sous_vetements", "cagoule"] as const
export type TypeEquipement = (typeof TYPES_EQUIPEMENT)[number]

export const SPECIALITES = ["mecanique", "pneus", "logistique", "photo", "secourisme", "commissaire", "autre"] as const
export type Specialite = (typeof SPECIALITES)[number]

export const REPONSES_DISPONIBILITE = ["vient", "ne_vient_pas", "peut_etre"] as const
export type ReponseDisponibilite = (typeof REPONSES_DISPONIBILITE)[number]

// Rôles d'épreuve. Pilote et copilote ne s'affectent jamais ici : ils se choisissent sur l'engagement (Saison).
export const ROLES_EPREUVE = ["pilote", "copilote", "chef_assistance", "assistance", "logistique", "photo"] as const
export type RoleEpreuve = (typeof ROLES_EPREUVE)[number]

export const INTERETS_VIVIER = ["faible", "moyen", "fort"] as const
export type InteretVivier = (typeof INTERETS_VIVIER)[number]

// Un rôle d'épreuve s'affecte ici sauf pilote et copilote : l'équipage se choisit sur l'engagement, dans Saison.
// Le rôle d'épreuve ne donne aucun droit (955 §4).
export function roleAffectable(role: RoleEpreuve): boolean {
  return role !== "pilote" && role !== "copilote"
}
