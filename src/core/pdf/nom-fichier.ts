// Nom de fichier des PDF : sans accents, sans espaces, en minuscules. « Koehling Racing Team » et « saison 2026 »
// donnent « bilan-koehling-racing-team-saison-2026.pdf ».
export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function nomFichierPdf(parties: string[]): string {
  const morceaux = parties.map(slugifier).filter((morceau) => morceau !== "")
  return `${morceaux.join("-") || "document"}.pdf`
}
