// Export tableur des mouvements (brief 2.6, section 1) : CSV à point-virgule, UTF-8 avec BOM pour que
// Excel lise les accents, montants au format français (virgule décimale, en euros).

export interface LigneCsv {
  date: string // AAAA-MM-JJ
  sens: string // déjà libellé (Dépense, Recette)
  libelle: string
  categorie: string
  payeur: string
  montantCentimes: number
  statut: string // déjà libellé
}

const EN_TETE = ["Date", "Sens", "Libellé", "Catégorie", "Payeur", "Montant (€)", "Statut"]
const SEPARATEUR = ";"
const BOM = "﻿"

// Une cellule est entourée de guillemets dès qu'elle contient le séparateur, un guillemet ou un saut de ligne.
// Les guillemets internes se doublent.
export function cellule(valeur: string): string {
  if (/[;"\r\n]/.test(valeur)) return `"${valeur.replace(/"/g, '""')}"`
  return valeur
}

// 1234,5 -> « 1234,50 » ; le signe moins est conservé (un remboursement n'est jamais négatif ici, mais la
// fonction reste exacte pour un montant quelconque).
export function montantFrancais(centimes: number): string {
  const signe = centimes < 0 ? "-" : ""
  const valeur = Math.abs(centimes)
  const euros = Math.floor(valeur / 100)
  const reste = String(valeur % 100).padStart(2, "0")
  return `${signe}${euros},${reste}`
}

export function csvMouvements(lignes: readonly LigneCsv[]): string {
  const lignesCsv = [EN_TETE, ...lignes.map((ligne) => [ligne.date, ligne.sens, ligne.libelle, ligne.categorie, ligne.payeur, montantFrancais(ligne.montantCentimes), ligne.statut])]
  return BOM + lignesCsv.map((ligneCsv) => ligneCsv.map(cellule).join(SEPARATEUR)).join("\r\n") + "\r\n"
}
