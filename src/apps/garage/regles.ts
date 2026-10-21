// Règles pures du Garage (tâche 4.1, brief section 3). Aucun accès base : les services passent les
// valeurs lues, ces fonctions renvoient un état. Les km sont des décimaux (correction A) : la somme
// passe par additionnerKm, pour qu'un arrondi ne s'accumule pas d'une épreuve à l'autre.

export type ModeUsure = "km" | "epreuves" | "les_deux"
export type Zone = "vert" | "orange" | "rouge" | "a_renseigner"

// Seuils par défaut d'un organe, en pourcentage de l'état. Constante unique : les défauts de
// garage_vehicle_component en base doivent être les mêmes (regles.test.ts le vérifie).
export const SEUILS_DEFAUT = { orange: 30, rouge: 10 } as const

export type Seuils = { orange: number; rouge: number }

// Durée de vie en km (décimale) et en épreuves (entière) ; null = non renseignée par la team.
export type DureesVie = { km: number | null; epreuves: number | null }

// Cumuls d'usure d'une pièce ou d'un train.
export type Usure = { km: number; epreuves: number }

export const TOUTES_LES_ZONES: readonly Zone[] = ["vert", "orange", "rouge", "a_renseigner"]

// Arrondi au dixième, sans l'erreur binaire d'une somme de décimaux (0,1 + 0,2 donne 0,3).
export function additionnerKm(total: number, ajout: number): number {
  return Math.round((total + ajout) * 10) / 10
}

// Durées effectives : celle de la pièce si elle est saisie, sinon celle de l'organe. Chaque valeur séparément.
export function dureesEffectives(piece: DureesVie, organe: DureesVie): DureesVie {
  return {
    km: piece.km ?? organe.km,
    epreuves: piece.epreuves ?? organe.epreuves,
  }
}

const borner = (valeur: number): number => Math.max(0, Math.min(100, valeur))

// État d'une pièce en pourcentage, borné à 0 (une pièce usée au-delà de sa vie est à 0 %, jamais négative).
// Mode km : 100 − km ÷ durée. Mode épreuves : 100 − épreuves ÷ durée. Les deux : le plus bas des deux,
// les deux durées sont alors requises. Renvoie null (« À renseigner ») si une durée requise manque.
export function etatPiece(mode: ModeUsure, durees: DureesVie, usure: Usure): number | null {
  const etatKm = durees.km !== null && durees.km > 0 ? borner(100 - (usure.km / durees.km) * 100) : null
  const etatEpreuves =
    durees.epreuves !== null && durees.epreuves > 0 ? borner(100 - (usure.epreuves / durees.epreuves) * 100) : null

  if (mode === "km") return etatKm
  if (mode === "epreuves") return etatEpreuves
  if (etatKm === null || etatEpreuves === null) return null
  return Math.min(etatKm, etatEpreuves)
}

// Zone d'un état, sur les seuils de l'organe. Bornes : un état égal au seuil orange est vert, un état égal
// au seuil rouge est orange, un état strictement sous le seuil rouge est rouge.
export function zoneDeEtat(etat: number | null, seuils: Seuils): Zone {
  if (etat === null) return "a_renseigner"
  if (etat >= seuils.orange) return "vert"
  if (etat >= seuils.rouge) return "orange"
  return "rouge"
}

// Km restants avant la zone rouge. Null en mode épreuves seul, sans durée de km, ou à renseigner.
// Zone rouge : usure > durée × (1 − seuil rouge ÷ 100). Jamais négatif.
export function kmRestantsAvantRouge(
  mode: ModeUsure,
  durees: DureesVie,
  usure: Usure,
  seuilRouge: number,
): number | null {
  if (mode === "epreuves") return null
  if (durees.km === null || durees.km <= 0) return null
  const restants = durees.km * (1 - seuilRouge / 100) - usure.km
  return Math.max(0, Math.round(restants * 10) / 10)
}

// Un organe qui entre dans l'indice : critique, avec une pièce montée, et un état renseigné.
export type OrganeIndice = {
  id: string
  critique: boolean
  pieceMontee: boolean
  etat: number | null
}

export type IndiceFiabilite = {
  // Moyenne des états retenus, à poids égaux. Null s'il n'y en a aucun.
  indice: number | null
  // Organes critiques sans pièce montée : signalés à part, jamais comptés à 0.
  sansPiece: string[]
  // Organes critiques avec une pièce montée, mais dont l'état est inconnu (durée de vie à renseigner) : hors de la moyenne.
  sansEtat: string[]
}

export function indiceFiabilite(organes: OrganeIndice[]): IndiceFiabilite {
  const retenus = organes.filter((o) => o.critique && o.pieceMontee && o.etat !== null)
  const sansPiece = organes.filter((o) => o.critique && !o.pieceMontee).map((o) => o.id)
  const sansEtat = organes.filter((o) => o.critique && o.pieceMontee && o.etat === null).map((o) => o.id)
  if (retenus.length === 0) return { indice: null, sansPiece, sansEtat }
  const somme = retenus.reduce((total, o) => total + (o.etat ?? 0), 0)
  return { indice: somme / retenus.length, sansPiece, sansEtat }
}

// Franchissement du seuil rouge : l'état passe de « au-dessus ou égal » à « strictement sous ». Une seule fois
// par franchissement ; un état déjà rouge ou inconnu avant ne déclenche rien.
export function franchitZoneRouge(avant: number | null, apres: number | null, seuilRouge: number): boolean {
  if (avant === null || apres === null) return false
  return avant >= seuilRouge && apres < seuilRouge
}

// L'indice affiché est arrondi à l'unité : l'événement garage.fiabilite_changee n'est émis que si cet entier change.
export function fiabiliteChangee(avant: number | null, apres: number | null): boolean {
  if (avant === null && apres === null) return false
  if (avant === null || apres === null) return true
  return Math.round(avant) !== Math.round(apres)
}

// État de l'organe Pneus (correction C) : 100 − usure estimée, sur le train monté. Null (« À renseigner »)
// si aucun train n'est monté ou si l'usure n'est pas saisie. L'organe n'est pas critique : il n'entre pas dans l'indice.
export function etatPneus(monte: boolean, usureEstimeePct: number | null): number | null {
  if (!monte || usureEstimeePct === null) return null
  return borner(100 - usureEstimeePct)
}

// Seuils valides : 0 ≤ rouge < orange ≤ 100.
export function seuilsValides(seuils: Seuils): boolean {
  return Number.isInteger(seuils.rouge) && Number.isInteger(seuils.orange)
    && seuils.rouge >= 0 && seuils.rouge < seuils.orange && seuils.orange <= 100
}
