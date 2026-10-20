// Espaces insécables : formatEuros en produit (U+00A0, U+202F). Barlow n'a pas de glyphe pour U+202F : elle
// sortirait en carré ou en vide dans le PDF. Dans le PDF seulement, les deux deviennent une espace ordinaire.
export function textePdf(texte: string): string {
  return texte.replace(/[  ]/g, " ")
}
