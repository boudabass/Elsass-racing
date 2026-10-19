// Règles pures de Voiture (tâche 3.2, brief section 4). Aucun accès à la base : ces fonctions reçoivent
// des données déjà lues et renvoient des décisions, testées dans regles.test.ts.

import { jourDeParis } from "@/core/dates"

import type { Gabarit, FormeEmplacement, VueGabarit } from "./gabarits/types"
import { bornesDu, miroirDeForme } from "./plan"

// ─── 4.1 Papiers ──────────────────────────────────────────────────────────────

export const SEUIL_RENOUVELLEMENT_JOURS = 30

export type StatutPapier = "valide" | "a_renouveler" | "expire"

// Pire statut d'abord : c'est l'ordre de gravité, pour la pastille des cartes.
const GRAVITE_PAPIER: Record<StatutPapier, number> = { valide: 0, a_renouveler: 1, expire: 2 }

// Les échéances viennent de colonnes `@db.Date` : Prisma les rend à minuit UTC, ce qui donne le jour civil
// sans décalage. « Aujourd'hui » se lit à Paris, comme partout (src/core/dates.ts).
function jourCivilEcheance(echeance: Date): string {
  return echeance.toISOString().slice(0, 10)
}

// Nombre de jours civils entre aujourd'hui (Paris) et l'échéance. Négatif si l'échéance est passée.
export function joursAvantEcheance(valableJusquAu: Date, maintenant: Date): number {
  const aujourdhui = Date.parse(`${jourDeParis(maintenant)}T00:00:00Z`)
  const echeance = Date.parse(`${jourCivilEcheance(valableJusquAu)}T00:00:00Z`)
  return Math.round((echeance - aujourdhui) / 86_400_000)
}

export function statutPapier(valableJusquAu: Date | null, maintenant: Date): StatutPapier {
  if (valableJusquAu === null) return "valide"
  const jours = joursAvantEcheance(valableJusquAu, maintenant)
  if (jours < 0) return "expire"
  if (jours <= SEUIL_RENOUVELLEMENT_JOURS) return "a_renouveler"
  return "valide"
}

// Pire statut de l'ensemble des papiers d'un véhicule. Sans papier : valide.
export function etatPapiers(papiers: Array<{ valableJusquAu: Date | null }>, maintenant: Date): StatutPapier {
  let pire: StatutPapier = "valide"
  for (const papier of papiers) {
    const statut = statutPapier(papier.valableJusquAu, maintenant)
    if (GRAVITE_PAPIER[statut] > GRAVITE_PAPIER[pire]) pire = statut
  }
  return pire
}

// Ordre d'affichage des papiers : expirés d'abord, puis à renouveler, puis valides.
const RANG_PAPIER: Record<StatutPapier, number> = { expire: 0, a_renouveler: 1, valide: 2 }

// Tri de l'onglet Papiers : par statut, puis par échéance (la plus proche d'abord ; sans échéance en dernier).
export function trierPapiers<T extends { statut: StatutPapier; valableJusquAu: Date | null }>(papiers: T[]): T[] {
  return [...papiers].sort((a, b) => {
    if (RANG_PAPIER[a.statut] !== RANG_PAPIER[b.statut]) return RANG_PAPIER[a.statut] - RANG_PAPIER[b.statut]
    if (a.valableJusquAu && b.valableJusquAu) return a.valableJusquAu.getTime() - b.valableJusquAu.getTime()
    if (a.valableJusquAu) return -1
    if (b.valableJusquAu) return 1
    return 0
  })
}

// État affiché sur la carte d'un véhicule : le pire statut, ou « aucun » sans aucun papier.
export type EtatPapiersVehicule = StatutPapier | "aucun"

export function etatPapiersVehicule(papiers: Array<{ valableJusquAu: Date | null }>, maintenant: Date): EtatPapiersVehicule {
  return papiers.length === 0 ? "aucun" : etatPapiers(papiers, maintenant)
}

// Papiers à renouveler ou expirés (les valides sont exclus), dans l'ordre d'affichage : expirés d'abord.
// Sert au widget « Papiers à renouveler » : le nombre, et le premier à traiter.
export function papiersARenouveler<T extends { valableJusquAu: Date | null }>(papiers: T[], maintenant: Date): Array<T & { statut: StatutPapier }> {
  const avecStatut = papiers.map((papier) => ({ ...papier, statut: statutPapier(papier.valableJusquAu, maintenant) }))
  return trierPapiers(avecStatut.filter((papier) => papier.statut !== "valide"))
}

// ─── 4.2 Emplacements ─────────────────────────────────────────────────────────

export type EmplacementInitial = {
  nom: string
  vue: VueGabarit
  ordre: number
  forme: FormeEmplacement | null
  symetrique: boolean
  statut: "libre"
}

// Emplacements à créer pour un nouveau véhicule. Un emplacement symétrique devient une ligne par côté, et le côté
// est dans le nom stocké (« Portière droite », « Portière gauche »). La forme gauche est la forme droite retournée.
export function emplacementsDepuisGabarit(gabarit: Gabarit): EmplacementInitial[] {
  const bornes = bornesDu(gabarit.viewBox)
  const emplacements: EmplacementInitial[] = []
  for (const type of gabarit.emplacementsTypes) {
    const vues: VueGabarit[] = [type.vue]
    if (type.symetrique) {
      for (const dessinee of gabarit.vuesDessinees) {
        if (dessinee.miroirDe === type.vue) vues.push(dessinee.vue)
      }
    }
    const paire = vues.length > 1
    for (const vue of vues) {
      const forme = vue === type.vue || type.forme === null ? type.forme : miroirDeForme(type.forme, bornes)
      emplacements.push({
        nom: paire ? `${type.nom} ${vue}` : type.nom,
        vue,
        ordre: type.ordre,
        forme,
        symetrique: paire,
        statut: "libre",
      })
    }
  }
  return emplacements
}

// Ligne d'un véhicule, vue par le complément : son identité, sa place, et si elle est libre (ni occupée, ni liée à
// une contrepartie, statut « libre »). Seule une ligne libre peut être retirée.
export type LigneComplement = { id: string; vue: VueGabarit; nom: string; libre: boolean }

// Réglages du complément : les noms que le gabarit ne porte plus, et la vue où range une ligne hors plan qui n'a pas
// d'équivalent (la vue affichée au moment du complément), avec la forme posée au centre de cette vue.
export type OptionsComplement = {
  nomsRetires: string[]
  vueAjout: VueGabarit
  formeAjout: FormeEmplacement
}

// Ce que le complément fait d'un véhicule. `creer` : les emplacements du gabarit qu'il n'a pas. `reprendre` : une
// ligne hors plan reçoit sa vue et sa forme, sans changer d'id ; son occupation, rattachée par id, et son historique
// restent donc valides. `retirer` : les lignes libres d'un nom retiré du gabarit (retrait logique). `conserves` : les
// noms retirés du gabarit mais occupés ou liés à une contrepartie, gardés et à signaler.
export type PlanComplement = {
  creer: EmplacementInitial[]
  reprendre: Array<{ id: string; vue: VueGabarit; forme: FormeEmplacement | null }>
  retirer: string[]
  conserves: string[]
}

// Une ligne déjà à la bonne vue n'est jamais touchée. Une ligne hors plan sans équivalent part dans la vue ajoutée.
// Idempotent : une seconde passe ne trouve plus rien à faire.
export function planComplement(existants: LigneComplement[], attendus: EmplacementInitial[], options: OptionsComplement): PlanComplement {
  const creer: EmplacementInitial[] = []
  const reprendre: PlanComplement["reprendre"] = []
  const retirer: string[] = []
  const conserves: string[] = []
  const repris = new Set<string>()
  // Lignes d'un nom retiré : jamais reprises, jamais recréées.
  const ecartees = new Set<string>()
  for (const ligne of existants) {
    if (!options.nomsRetires.includes(ligne.nom)) continue
    ecartees.add(ligne.id)
    if (ligne.libre) retirer.push(ligne.id)
    else conserves.push(ligne.nom)
  }
  for (const attendu of attendus) {
    if (existants.some((e) => e.vue === attendu.vue && e.nom === attendu.nom && !ecartees.has(e.id))) continue
    const horsPlan = existants.find((e) => e.vue === "hors_plan" && e.nom === attendu.nom && !repris.has(e.id) && !ecartees.has(e.id))
    if (horsPlan) {
      repris.add(horsPlan.id)
      reprendre.push({ id: horsPlan.id, vue: attendu.vue, forme: attendu.forme })
      continue
    }
    creer.push(attendu)
  }
  for (const ligne of existants) {
    if (ligne.vue !== "hors_plan" || repris.has(ligne.id) || ecartees.has(ligne.id)) continue
    reprendre.push({ id: ligne.id, vue: options.vueAjout, forme: options.formeAjout })
  }
  return { creer, reprendre, retirer, conserves }
}

export type StatutOccupation = "reserve" | "pose" | "retire"
export type StatutEmplacement = "libre" | "reserve" | "occupe" | "indisponible"

// Statut d'un emplacement. `occupationActive` : son occupation non retirée, ou null.
// `indisponible` n'est jamais déduit : c'est le seul statut posé à la main.
export function statutEmplacement(occupationActive: { statut: StatutOccupation } | null, indisponible = false): StatutEmplacement {
  if (indisponible) return "indisponible"
  if (occupationActive === null) return "libre"
  return occupationActive.statut === "pose" ? "occupe" : "reserve"
}

export function peutRecevoirOccupation(statut: StatutEmplacement): boolean {
  return statut !== "indisponible"
}

export type Verification = { ok: true } | { ok: false; message: string }

// Transitions d'une occupation : de réservé à posé ou retiré, de posé à retiré. Le reste est refusé.
const TRANSITIONS_OCCUPATION: Record<StatutOccupation, StatutOccupation[]> = {
  reserve: ["pose", "retire"],
  pose: ["retire"],
  retire: [],
}

export function verifierTransitionOccupation(de: StatutOccupation, vers: StatutOccupation): Verification {
  if (TRANSITIONS_OCCUPATION[de].includes(vers)) return { ok: true }
  if (de === "retire") return { ok: false, message: "Cette occupation est retirée : elle ne peut plus changer." }
  if (de === vers) return { ok: false, message: "Le logo est déjà dans cet état." }
  return { ok: false, message: "Un logo posé ne peut pas revenir à l'état réservé." }
}

// ─── 4.3 Fiches de réglage ────────────────────────────────────────────────────

export type GroupeReglage = "essentiel" | "avance"

export type ChampReglage = {
  cle: string
  libelle: string
  unite: string
  groupe: GroupeReglage
}

const COTES_PNEUS = [
  { suffixe: "avg", libelle: "avant gauche" },
  { suffixe: "avd", libelle: "avant droit" },
  { suffixe: "arg", libelle: "arrière gauche" },
  { suffixe: "ard", libelle: "arrière droit" },
]

// Liste ordonnée des champs de réglage. Essentiels : visibles. Avancés : repliés à la 3.3.
export const CHAMPS_REGLAGE: ChampReglage[] = [
  ...COTES_PNEUS.map((c) => ({ cle: `pression_froid_${c.suffixe}`, libelle: `Pression à froid, ${c.libelle}`, unite: "bar", groupe: "essentiel" as const })),
  ...COTES_PNEUS.map((c) => ({ cle: `pression_chaud_${c.suffixe}`, libelle: `Pression à chaud, ${c.libelle}`, unite: "bar", groupe: "essentiel" as const })),
  { cle: "hauteur_caisse_avant", libelle: "Hauteur de caisse avant", unite: "mm", groupe: "essentiel" },
  { cle: "hauteur_caisse_arriere", libelle: "Hauteur de caisse arrière", unite: "mm", groupe: "essentiel" },
  { cle: "amortisseur_compression_avant", libelle: "Amortisseur, compression avant", unite: "clics", groupe: "avance" },
  { cle: "amortisseur_compression_arriere", libelle: "Amortisseur, compression arrière", unite: "clics", groupe: "avance" },
  { cle: "amortisseur_detente_avant", libelle: "Amortisseur, détente avant", unite: "clics", groupe: "avance" },
  { cle: "amortisseur_detente_arriere", libelle: "Amortisseur, détente arrière", unite: "clics", groupe: "avance" },
  { cle: "carrossage_avant", libelle: "Carrossage avant", unite: "°", groupe: "avance" },
  { cle: "carrossage_arriere", libelle: "Carrossage arrière", unite: "°", groupe: "avance" },
  { cle: "parallelisme_avant", libelle: "Parallélisme avant", unite: "mm", groupe: "avance" },
  { cle: "parallelisme_arriere", libelle: "Parallélisme arrière", unite: "mm", groupe: "avance" },
  { cle: "barre_antiroulis_avant", libelle: "Barre antiroulis avant", unite: "cran", groupe: "avance" },
  { cle: "barre_antiroulis_arriere", libelle: "Barre antiroulis arrière", unite: "cran", groupe: "avance" },
  { cle: "repartition_freinage", libelle: "Répartition de freinage", unite: "%", groupe: "avance" },
  { cle: "rapport_pont", libelle: "Rapport de pont", unite: "", groupe: "avance" },
]

export type ValeurReglage = number | string
export type ValeursReglage = Record<string, ValeurReglage>

export const PRESSION_MIN_BAR = 0.5
export const PRESSION_MAX_BAR = 4

// Renvoie la liste des erreurs en français, vide si les valeurs sont acceptables.
export function validerValeurs(valeurs: ValeursReglage): string[] {
  const erreurs: string[] = []
  const connus = new Set(CHAMPS_REGLAGE.map((c) => c.cle))
  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (!connus.has(cle)) {
      erreurs.push(`Champ inconnu : ${cle}.`)
      continue
    }
    if (cle.startsWith("pression_")) {
      if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
        erreurs.push(`La pression doit être un nombre (${cle}).`)
      } else if (valeur < PRESSION_MIN_BAR || valeur > PRESSION_MAX_BAR) {
        erreurs.push(`La pression doit être entre 0,5 et 4 bar (${cle}).`)
      }
    }
  }
  return erreurs
}

// Valeurs de départ d'une nouvelle fiche : la fiche de référence choisie, sinon la dernière fiche du
// véhicule, sinon rien.
export function preremplir(derniere: ValeursReglage | null, reference: ValeursReglage | null): ValeursReglage {
  return { ...(reference ?? derniere ?? {}) }
}

export type ComparaisonChamp = {
  cle: string
  libelle: string
  unite: string
  a: ValeurReglage | null
  b: ValeurReglage | null
  different: boolean
}

// Comparaison côte à côte de deux fiches, champ par champ, dans l'ordre de CHAMPS_REGLAGE.
export function comparer(a: ValeursReglage, b: ValeursReglage): ComparaisonChamp[] {
  return CHAMPS_REGLAGE.map((champ) => {
    const valeurA = a[champ.cle] ?? null
    const valeurB = b[champ.cle] ?? null
    return {
      cle: champ.cle,
      libelle: champ.libelle,
      unite: champ.unite,
      a: valeurA,
      b: valeurB,
      different: valeurA !== valeurB,
    }
  })
}
