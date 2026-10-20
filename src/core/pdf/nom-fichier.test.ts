import { describe, expect, it } from "vitest"

import { nomFichierPdf, slugifier } from "./nom-fichier"

describe("slugifier", () => {
  it("retire les accents et remplace tout le reste par des tirets", () => {
    expect(slugifier("Équipe d'Alsace, saison 2026")).toBe("equipe-d-alsace-saison-2026")
  })
})

describe("nomFichierPdf", () => {
  it("assemble les parties en un nom de PDF", () => {
    expect(nomFichierPdf(["bilan", "Koehling Racing Team", "saison 2026"])).toBe("bilan-koehling-racing-team-saison-2026.pdf")
  })

  it("garde un nom de repli quand il ne reste rien", () => {
    expect(nomFichierPdf(["???", ""])).toBe("document.pdf")
  })
})
