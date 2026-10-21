import { describe, expect, it } from "vitest"

import { categorieParCle } from "./regles"

// Garage propose ses dépenses par la clé stable de la catégorie (D8). Catégorie absente : null, et Budget n'écrit rien.
describe("catégorie Garage par clé", () => {
  const categories = [
    { id: "cat-engagement", cle: "engagement" },
    { id: "cat-pieces", cle: "pieces" },
    { id: "cat-main", cle: "main_oeuvre" },
    { id: "cat-divers", cle: null },
  ]

  it("trouve la catégorie par sa clé", () => {
    expect(categorieParCle(categories, "pieces")).toBe("cat-pieces")
    expect(categorieParCle(categories, "main_oeuvre")).toBe("cat-main")
  })

  it("rend null quand la clé manque : la proposition n'est pas créée, rien n'est écrit", () => {
    expect(categorieParCle([{ id: "cat-engagement", cle: "engagement" }], "pieces")).toBeNull()
    expect(categorieParCle([], "main_oeuvre")).toBeNull()
  })

  it("ne prend jamais une catégorie sans clé, même dont le nom ressemble", () => {
    const sansCle = [{ id: "cat-pieces-nom", cle: null }]
    expect(categorieParCle(sansCle, "pieces")).toBeNull()
  })
})
