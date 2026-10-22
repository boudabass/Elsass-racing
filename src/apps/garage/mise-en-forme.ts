// Mise en forme de l'atelier (tâche 4.2, brief §1). Module pur, sans accès base : il est testé seul. Le mot de la zone
// et l'ordre des cartes viennent d'ici ; les seuils sont ceux des pièces (regles.ts), jamais recopiés.

import { SEUILS_DEFAUT, zoneDeEtat, type Zone } from "./regles"

// Mot de la zone : ce que l'écran écrit à côté de l'état. La zone se lit aussi par la forme, jamais par la couleur seule.
// Le rouge ne dit pas « à changer » : le Garage informe, il ne pousse pas à l'achat (brief 4.3e, section 8).
export const LIBELLE_ZONE: Record<Zone, string> = {
  vert: "Bon",
  orange: "À surveiller",
  rouge: "Zone rouge",
  a_renseigner: "À renseigner",
}

export function libelleZone(zone: Zone): string {
  return LIBELLE_ZONE[zone]
}

// Zone de l'indice de fiabilité : même seuils que les pièces. Sans indice, « À renseigner ».
export function zoneIndice(indice: number | null): Zone {
  return zoneDeEtat(indice, SEUILS_DEFAUT)
}

// État en pourcentage, entier, avec l'espace insécable avant « % ». Null sans état.
export function pourcentage(etat: number | null): string | null {
  if (etat === null) return null
  return `${Math.round(etat)} %`
}

// Cartes : les organes critiques d'abord, puis l'ordre des types (déjà celui de la base). Le tri est stable.
export function ordreDesOrganes<T extends { critique: boolean }>(organes: T[]): T[] {
  return [...organes].sort((a, b) => Number(b.critique) - Number(a.critique))
}

// Km restants avant la zone rouge, en phrase. Null quand la durée ne le permet pas.
export function phraseKmRestants(km: number | null): string | null {
  if (km === null) return null
  if (km === 0) return "Zone rouge atteinte"
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(km))} km avant la zone rouge`
}

// Organe vu par le mot de l'indice : seuls comptent les critiques avec une pièce montée et un état connu (comme la moyenne).
export type OrganeMot = { nom: string; critique: boolean; pieceMontee: boolean; zone: Zone }

const RANG_ZONE: Record<Zone, number> = { a_renseigner: 0, vert: 1, orange: 2, rouge: 3 }

// Nom d'organe dans une phrase : l'initiale en minuscule (« boîte de vitesses »).
function dansUnePhrase(nom: string): string {
  return nom.charAt(0).toLocaleLowerCase("fr-FR") + nom.slice(1)
}

// Liste de noms, à la française : « embrayage », « embrayage et 1 autre », « embrayage et 2 autres ».
export function enumererOrganes(noms: string[]): string {
  if (noms.length === 1) return noms[0]
  return `${noms[0]} et ${noms.length - 1} autre${noms.length > 2 ? "s" : ""}`
}

// Mot de l'indice : le pire organe critique renseigné. Un rouge l'emporte sur un orange, et le mot nomme les organes de
// cette zone. Sans rouge ni orange, « Bon » ; sans organe retenu, « À renseigner ».
export function motIndice(organes: OrganeMot[]): string {
  const retenus = organes.filter((o) => o.critique && o.pieceMontee && o.zone !== "a_renseigner")
  if (retenus.length === 0) return LIBELLE_ZONE.a_renseigner
  const pire = retenus.reduce<Zone>((zone, o) => (RANG_ZONE[o.zone] > RANG_ZONE[zone] ? o.zone : zone), "vert")
  if (pire === "vert") return LIBELLE_ZONE.vert
  const noms = retenus.filter((o) => o.zone === pire).map((o) => dansUnePhrase(o.nom))
  return `${LIBELLE_ZONE[pire]} : ${enumererOrganes(noms)}`
}

// Un organe nommé dans une phrase de l'atelier : son nom renvoie à sa fiche.
export type OrganeNomme = { id: string; nom: string }

// Une phrase de l'atelier dont les noms d'organes sont des liens. Texte avant la liste, texte après.
export type PhraseAtelier = { debut: string; organes: OrganeNomme[]; fin: string }

// Ce qui manque à l'indice quand il n'y en a pas. Jamais « rien ne manque » tant qu'un organe critique n'a pas d'état :
// une pièce à monter d'abord, puis une durée de vie à renseigner. Sans organe critique, une seule phrase le dit.
export function phrasesIndiceAbsent(sansPiece: OrganeNomme[], sansEtat: OrganeNomme[]): PhraseAtelier[] {
  if (sansPiece.length === 0 && sansEtat.length === 0) {
    return [{ debut: "Aucun organe critique sur cette voiture.", organes: [], fin: "" }]
  }
  const phrases: PhraseAtelier[] = []
  if (sansPiece.length > 0) phrases.push({ debut: "Il manque une pièce montée sur : ", organes: sansPiece, fin: "." })
  if (sansEtat.length > 0) phrases.push({ debut: "Renseigne la durée de vie de : ", organes: sansEtat, fin: " pour calculer l'indice." })
  return phrases
}

const FORMAT_JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" })

// Date d'un événement de l'atelier, à la française et à l'heure de Paris (le stockage est en UTC).
export function dateAtelier(date: Date): string {
  return FORMAT_JOUR.format(date)
}

// Kilomètres entiers, séparés par milliers : « 105 000 km ».
export function kmAtelier(km: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(km))} km`
}

// --- Stock (tâche 4.2, §3) --------------------------------------------------------------------

// Pièce vue par le stock : une ligne de garage_part, avec le nom et l'ordre de son type d'organe.
export type PieceStock = {
  id: string
  designation: string
  marque: string | null
  reference: string | null
  qualite: string
  statut: string
  emplacement: string | null
  componentTypeId: string
  organeNom: string
  organeOrdre: number
}

// Pièces identiques (même désignation, marque, référence, qualité) : une ligne, avec leur quantité. Chaque pièce reste
// ouvrable : la ligne garde la liste.
export type GroupePieces = {
  cle: string
  designation: string
  marque: string | null
  reference: string | null
  qualite: string
  pieces: PieceStock[]
}

export type GroupeOrgane = {
  componentTypeId: string
  organeNom: string
  groupes: GroupePieces[]
}

// Stock groupé par organe, dans l'ordre des types, puis par désignation à l'intérieur d'un organe.
export function regrouperStock(pieces: PieceStock[]): GroupeOrgane[] {
  const parOrgane = new Map<string, { nom: string; ordre: number; pieces: PieceStock[] }>()
  for (const piece of pieces) {
    const organe = parOrgane.get(piece.componentTypeId) ?? { nom: piece.organeNom, ordre: piece.organeOrdre, pieces: [] }
    organe.pieces.push(piece)
    parOrgane.set(piece.componentTypeId, organe)
  }

  return Array.from(parOrgane.entries())
    .sort(([, a], [, b]) => a.ordre - b.ordre)
    .map(([componentTypeId, organe]) => {
      const parCle = new Map<string, GroupePieces>()
      for (const piece of organe.pieces) {
        const cle = [piece.designation, piece.marque ?? "", piece.reference ?? "", piece.qualite].join("|")
        const groupe = parCle.get(cle) ?? {
          cle,
          designation: piece.designation,
          marque: piece.marque,
          reference: piece.reference,
          qualite: piece.qualite,
          pieces: [],
        }
        groupe.pieces.push(piece)
        parCle.set(cle, groupe)
      }
      const groupes = Array.from(parCle.values()).sort((a, b) => a.designation.localeCompare(b.designation, "fr"))
      return { componentTypeId, organeNom: organe.nom, groupes }
    })
}
