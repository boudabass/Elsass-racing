// Règles pures d'Équipe (tâche 5.1, brief section 3). Aucun accès à la base : ces fonctions reçoivent des données
// déjà lues et renvoient des décisions, testées dans regles.test.ts.
//
// Les statistiques ne comptent que les résultats validés : les lectures (lectures-serveur.ts) ne passent que ceux-là.

import { statutPapier, type StatutPapier } from "@/apps/voiture/regles"
import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

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

// Validité à un jour donné (la date de l'épreuve, pas aujourd'hui). Les dates sont des jours civils (minuit UTC) :
// elles se comparent en « AAAA-MM-JJ ». Sans date de fin, pas d'expiration ; sans date de début, rien à attendre.
export function jourCivil(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function licenceValideA(valableDu: Date | null, valableAu: Date | null, jour: Date): boolean {
  const cible = jourCivil(jour)
  if (valableDu && jourCivil(valableDu) > cible) return false
  if (valableAu && jourCivil(valableAu) < cible) return false
  return true
}

export function homologationValideA(finHomologation: Date | null, jour: Date): boolean {
  return !finHomologation || jourCivil(finHomologation) >= jourCivil(jour)
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

// Barre vers le palier suivant : la part du chemin entre le seuil du palier courant et celui du suivant, en pourcentage
// entier. Null au dernier palier (rien à atteindre).
export function progressionPalier(nombreEpreuves: number, palier: Palier): { suivant: Palier; restant: number; pourcentage: number } | null {
  const suivant = PALIERS[rang(palier) + 1]
  if (!suivant) return null
  const debut = SEUIL_PALIER[palier]
  const fin = SEUIL_PALIER[suivant]
  const part = Math.round(((nombreEpreuves - debut) / (fin - debut)) * 100)
  return { suivant, restant: Math.max(0, fin - nombreEpreuves), pourcentage: Math.min(100, Math.max(0, part)) }
}

// Épreuves d'assistance : celles où la personne était affectée ET a répondu « vient ». Les deux listes sont des
// identifiants d'épreuve, sans doublon compté deux fois.
export function epreuvesAssistanceIds(affectees: string[], venues: string[]): string[] {
  const venue = new Set(venues)
  return Array.from(new Set(affectees.filter((epreuve) => venue.has(epreuve))))
}

export function epreuvesAssistance(affectees: string[], venues: string[]): number {
  return epreuvesAssistanceIds(affectees, venues).length
}

// Épreuves comptées pour le palier : une épreuve où la personne était à la fois dans l'équipage et en assistance
// ne compte qu'une fois.
export function epreuvesDuPalier(equipage: string[], assistance: string[]): number {
  return new Set([...equipage, ...assistance]).size
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
  // Meilleur rang au scratch et meilleur rang de classe parmi les arrivées classées ; null sans arrivée classée.
  meilleurScratch: number | null
  meilleurClasse: number | null
}

// Plus petit rang non nul d'une liste, ou null sans rang : le meilleur d'une série de classements.
function meilleurRang(rangs: Array<number | null>): number | null {
  const connus = rangs.filter((rang): rang is number => rang !== null)
  return connus.length === 0 ? null : Math.min(...connus)
}

export function statistiquesPersonne(resultats: ResultatValide[]): StatistiquesPersonne {
  const arrivees = resultats.filter((r) => r.statutFinal === "arrivee")
  return {
    epreuves: resultats.length,
    arrivees: arrivees.length,
    tauxArrivee: resultats.length === 0 ? null : arrivees.length / resultats.length,
    kmChronometres: resultats.reduce((total, r) => total + r.kmSpeciale, 0),
    meilleurScratch: meilleurRang(arrivees.map((r) => r.classementGeneral)),
    meilleurClasse: meilleurRang(arrivees.map((r) => r.classementClasse)),
  }
}

export interface StatistiquesBinome {
  epreuvesCommunes: number
  kmEnsemble: number
  arriveesEnsemble: number
  // Meilleurs rangs ensemble parmi les arrivées classées ; null sans rang connu.
  meilleurScratch: number | null
  meilleurClasse: number | null
}

// Binôme pilote et copilote : les résultats sont ceux des engagements où les deux étaient inscrits.
export function statistiquesBinome(resultats: ResultatValide[]): StatistiquesBinome {
  const arrivees = resultats.filter((r) => r.statutFinal === "arrivee")
  return {
    epreuvesCommunes: resultats.length,
    kmEnsemble: resultats.reduce((total, r) => total + r.kmSpeciale, 0),
    arriveesEnsemble: arrivees.length,
    meilleurScratch: meilleurRang(arrivees.map((r) => r.classementGeneral)),
    meilleurClasse: meilleurRang(arrivees.map((r) => r.classementClasse)),
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

export const LIBELLES_TYPE_EQUIPEMENT: Record<TypeEquipement, string> = {
  casque: "Casque",
  hans: "HANS",
  combinaison: "Combinaison",
  gants: "Gants",
  bottines: "Bottines",
  sous_vetements: "Sous-vêtements",
  cagoule: "Cagoule",
}

export const SPECIALITES = ["mecanique", "pneus", "logistique", "photo", "secourisme", "commissaire", "autre"] as const
export type Specialite = (typeof SPECIALITES)[number]

export const REPONSES_DISPONIBILITE = ["vient", "ne_vient_pas", "peut_etre"] as const
export type ReponseDisponibilite = (typeof REPONSES_DISPONIBILITE)[number]

// Rôles d'épreuve. Pilote et copilote ne s'affectent jamais ici : ils se choisissent sur l'engagement (Saison).
export const ROLES_EPREUVE = ["pilote", "copilote", "chef_assistance", "assistance", "logistique", "photo"] as const
export type RoleEpreuve = (typeof ROLES_EPREUVE)[number]

// Titre de la tâche liée à une affectation (core_task) : le rôle, tel qu'on le dit au rallye.
export const LIBELLES_ROLE_EPREUVE: Record<RoleEpreuve, string> = {
  pilote: "Pilote",
  copilote: "Copilote",
  chef_assistance: "Chef d'assistance",
  assistance: "Assistance",
  logistique: "Logistique",
  photo: "Photo",
}

export const INTERETS_VIVIER = ["faible", "moyen", "fort"] as const
export type InteretVivier = (typeof INTERETS_VIVIER)[number]

// Un rôle d'épreuve s'affecte ici sauf pilote et copilote : l'équipage se choisit sur l'engagement, dans Saison.
// Le rôle d'épreuve ne donne aucun droit (955 §4).
// Une tâche liée se change par la personne assignée, ou par qui a l'écriture sur Équipe. Pas de tâche sans personne
// assignée : seul le niveau écriture la change.
export function peutChangerTache(niveau: Niveau, personneDuMembre: string | null, assigneePersonId: string | null): boolean {
  if (aAuMoins(niveau, "ecriture")) return true
  return personneDuMembre !== null && personneDuMembre === assigneePersonId
}

export function roleAffectable(role: RoleEpreuve): boolean {
  return role !== "pilote" && role !== "copilote"
}

// Pastille d'une personne pour une liste d'échéances (licences ou équipements) : la plus urgente. Null sans échéance suivie.
const RANG_ECHEANCE: Record<StatutEcheance, number> = { valide: 0, a_renouveler: 1, expire: 2 }

export function statutLePlusUrgent(statuts: StatutEcheance[]): StatutEcheance | null {
  if (statuts.length === 0) return null
  return statuts.reduce((pire, statut) => (RANG_ECHEANCE[statut] > RANG_ECHEANCE[pire] ? statut : pire))
}

// Une personne compte comme équipage (statistiques pilote et copilote, binômes) si l'un de ses rôles habituels l'est.
export function estEquipage(roles: RoleHabituel[]): boolean {
  return roles.includes("pilote") || roles.includes("copilote")
}

// Binômes où figure la personne : son partenaire et le rôle qu'elle y tient.
export function binomesDePersonne<T extends { piloteId: string; copiloteId: string }>(personId: string, binomes: T[]): T[] {
  return binomes.filter((binome) => binome.piloteId === personId || binome.copiloteId === personId)
}
