// Règles pures de Budget (tâche 2.5, brief section 3). Aucun accès à la base : ces fonctions reçoivent
// des montants en centimes et renvoient des décisions, testées dans regles.test.ts.

import { aAuMoins, type Niveau } from "@/core/droits/niveaux"

export type TypePayeur = "membre" | "caisse_team" | "compte_association"
export type StatutRemboursement = "non_concerne" | "a_rembourser" | "partiel" | "rembourse"
export type Origine = "saisie" | "proposee"
export type Couleur = "vert" | "orange" | "rouge"

export const MESSAGE_LIGNE_TROP_GRANDE = "Ce remboursement dépasse ce qui reste dû sur cette dépense."

// 1. À rembourser : seule une dépense payée par un membre (et non par la caisse ou une association) lui est due.
export function aRembourser(type: TypePayeur): boolean {
  return type === "membre"
}

// 2. Statut de remboursement d'une dépense, à partir de ses lignes de remboursement (montants en centimes).
export function statutRemboursement(depense: { montant: number; aRembourser: boolean }, lignes: readonly number[]): StatutRemboursement {
  if (!depense.aRembourser) return "non_concerne"
  const rembourse = somme(lignes)
  if (rembourse <= 0) return "a_rembourser"
  if (rembourse >= depense.montant) return "rembourse"
  return "partiel"
}

export function resteDu(montant: number, lignes: readonly number[]): number {
  return Math.max(0, montant - somme(lignes))
}

// Une ligne ne peut pas dépasser le reste dû : renvoie le refus, ou null si la ligne passe.
export function verifierLigne(resteDuDepense: number, montantLigne: number): string | null {
  if (montantLigne <= 0) return "Le montant remboursé doit être positif."
  if (montantLigne > resteDuDepense) return MESSAGE_LIGNE_TROP_GRANDE
  return null
}

// 3. Solde par membre : ses dépenses confirmées à rembourser, moins ses remboursements.
// Ce que la team lui doit ne peut pas être négatif : un trop-perçu est renvoyé à part, pour être signalé.
export interface DepenseSolde {
  montant: number
  confirmee: boolean
  aRembourser: boolean
  personneId: string | null
}

export function soldeMembre(
  personneId: string,
  depenses: readonly DepenseSolde[],
  remboursements: readonly { personneId: string; montant: number }[],
): { du: number; trop: number } {
  const dues = depenses
    .filter((depense) => depense.confirmee && depense.aRembourser && depense.personneId === personneId)
    .reduce((total, depense) => total + depense.montant, 0)
  const verses = remboursements.filter((remboursement) => remboursement.personneId === personneId).reduce((total, remboursement) => total + remboursement.montant, 0)
  const solde = dues - verses
  return { du: Math.max(0, solde), trop: Math.max(0, -solde) }
}

// 4. Coûts. Les montants sont ceux des dépenses confirmées ; les km ceux des résultats validés de Saison.
export interface DepenseCout {
  montant: number
  confirmee: boolean
  eventId: string | null
}

export function coutParEpreuve(depenses: readonly DepenseCout[], eventId: string): number {
  return somme(depenses.filter((depense) => depense.confirmee && depense.eventId === eventId).map((depense) => depense.montant))
}

// Moyenne des coûts des épreuves données (par exemple les seuls rallyes) ; null s'il n'y en a aucune.
export function coutMoyen(couts: readonly number[]): number | null {
  if (couts.length === 0) return null
  return Math.round(somme(couts) / couts.length)
}

// Coût du kilomètre chronométré, en centimes par km ; null sans km (pas de division par zéro).
export function coutAuKm(montantTotal: number, kmChronometres: number): number | null {
  if (kmChronometres <= 0) return null
  return Math.round(montantTotal / kmChronometres)
}

// Écart au prévisionnel : vert jusqu'à 90 %, orange de 90 à 100 %, rouge au-delà. Sans prévu, rouge dès qu'il y a une dépense.
export function ecartPrevisionnel(prevu: number, reel: number): { ecart: number; pourcent: number | null; couleur: Couleur } {
  const ecart = reel - prevu
  if (prevu <= 0) return { ecart, pourcent: null, couleur: reel > 0 ? "rouge" : "vert" }
  const pourcent = (reel / prevu) * 100
  const couleur: Couleur = pourcent <= 90 ? "vert" : pourcent <= 100 ? "orange" : "rouge"
  return { ecart, pourcent, couleur }
}

// 5. Confirmation : une dépense saisie par un membre est confirmée d'office ; une dépense proposée
// (par une autre app) attend qu'un humain la valide.
export function confirmeeDOffice(origine: Origine): boolean {
  return origine === "saisie"
}

// Dépassement du prévisionnel : vrai une seule fois, au franchissement (avant le prévu, après le prévu).
export function franchissementPrevisionnel(prevu: number | null, totalAvant: number, totalApres: number): boolean {
  if (prevu === null) return false
  return totalAvant <= prevu && totalApres > prevu
}

// Visibilité : la lecture voit tous les mouvements, sans rien écrire. Seule la contribution se limite à
// ses propres dépenses (celles dont le payeur est sa personne) et à son solde.
// (La contribution est au-dessus de la lecture dans la hiérarchie : elle est donc exclue explicitement.)
export function voitTout(niveau: Niveau): boolean {
  return niveau === "lecture" || aAuMoins(niveau, "ecriture")
}

export function depensesVisibles<T extends { personneId: string | null }>(depenses: readonly T[], niveau: Niveau, personneId: string | null): T[] {
  if (voitTout(niveau)) return [...depenses]
  if (personneId === null) return []
  return depenses.filter((depense) => depense.personneId === personneId)
}

function somme(valeurs: readonly number[]): number {
  return valeurs.reduce((total, valeur) => total + valeur, 0)
}

// Mode de paiement de Saison (chèque, virement, en ligne, espèces) pour une dépense de Budget. Sans moyen
// renseigné : virement, comme avant.
export function modePaiementSaison(moyen: string | null): "cheque" | "virement" | "en_ligne" | "especes" {
  if (moyen === "cheque") return "cheque"
  if (moyen === "carte") return "en_ligne"
  if (moyen === "especes") return "especes"
  return "virement"
}

// Comptes où une recette peut être encaissée : tous les payeurs sauf les membres. La caisse de la team est proposée
// par défaut (brief 3.9, §3).
export function comptesEncaissement(payeurs: ReadonlyArray<{ id: string; nom: string; type: string }>) {
  return payeurs.filter((payeur) => payeur.type !== "membre").map(({ id, nom, type }) => ({ id, nom, parDefaut: type === "caisse_team" }))
}
