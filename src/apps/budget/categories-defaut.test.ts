import { describe, expect, it } from "vitest"

import { CATEGORIES_DEPENSE, CLE_CATEGORIE } from "./categories-defaut"

// Les clés stables servent aux liaisons (Saison, Garage) : chacune doit désigner une catégorie
// existante de dépense, et deux catégories ne partagent jamais la même clé.
describe("clés stables des catégories", () => {
  it("chaque clé désigne une catégorie de dépense existante", () => {
    for (const nom of Object.keys(CLE_CATEGORIE)) {
      expect(CATEGORIES_DEPENSE).toContain(nom)
    }
  })

  it("les clés sont uniques", () => {
    const cles = Object.values(CLE_CATEGORIE)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it("Pièces et Main-d'œuvre portent les clés attendues par Garage (D8)", () => {
    expect(CLE_CATEGORIE["Pièces"]).toBe("pieces")
    expect(CLE_CATEGORIE["Main-d'œuvre"]).toBe("main_oeuvre")
  })

  it("Divers porte la clé de repli (divers)", () => {
    expect(CLE_CATEGORIE["Divers"]).toBe("divers")
  })
})
