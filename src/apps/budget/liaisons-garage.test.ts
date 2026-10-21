import { describe, expect, it } from "vitest"

import { choisirCategorie } from "./regles"

// Garage propose ses dépenses par la clé stable de la catégorie (D8). Repli : la clé demandée, puis « divers », puis la
// première catégorie de dépense active. Le repli porte « à classer ». Aucune catégorie : rien n'est créé.
describe("choix de catégorie pour une dépense du Garage", () => {
  const categories = [
    { id: "cat-engagement", cle: "engagement" },
    { id: "cat-pieces", cle: "pieces" },
    { id: "cat-main", cle: "main_oeuvre" },
    { id: "cat-divers", cle: "divers" },
    { id: "cat-sans-cle", cle: null },
  ]

  it("prend la catégorie de la clé demandée, sans repli", () => {
    expect(choisirCategorie(categories, "pieces")).toEqual({ id: "cat-pieces", repli: false })
    expect(choisirCategorie(categories, "main_oeuvre")).toEqual({ id: "cat-main", repli: false })
  })

  it("sans la clé demandée, prend « divers » et signale le repli", () => {
    const sansPieces = categories.filter((c) => c.cle !== "pieces")
    expect(choisirCategorie(sansPieces, "pieces")).toEqual({ id: "cat-divers", repli: true })
  })

  it("sans la clé ni « divers », prend la première catégorie de dépense active, en repli", () => {
    const sansRepli = [
      { id: "cat-engagement", cle: "engagement" },
      { id: "cat-sans-cle", cle: null },
    ]
    expect(choisirCategorie(sansRepli, "pieces")).toEqual({ id: "cat-engagement", repli: true })
  })

  it("rend null quand la team n'a aucune catégorie de dépense active : rien n'est créé", () => {
    expect(choisirCategorie([], "pieces")).toBeNull()
  })

  it("une catégorie sans clé ne vaut jamais la clé demandée, même si son nom ressemble : elle ne sert qu'en dernier repli", () => {
    expect(choisirCategorie([{ id: "cat-pieces-nom", cle: null }], "pieces")).toEqual({ id: "cat-pieces-nom", repli: true })
    expect(choisirCategorie([{ id: "cat-pieces-nom", cle: null }, { id: "cat-pieces", cle: "pieces" }], "pieces")).toEqual({ id: "cat-pieces", repli: false })
  })
})
