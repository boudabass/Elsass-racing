import { describe, expect, it } from "vitest"

import { parametresSauf, pastillesFiltres, type ChoixFiltres } from "./filtres-url"

const choix: ChoixFiltres = {
  epreuves: [{ id: "e1", nom: "Rallye du Kochersberg" }],
  categoriesDepense: [{ id: "c1", nom: "Pneus" }],
  categoriesRecette: [{ id: "c2", nom: "Partenaire" }],
  payeurs: [{ id: "p1", nom: "Jean Koehling" }],
}

describe("parametresSauf", () => {
  it("garde les valeurs non vides et retire les clés demandées", () => {
    expect(parametresSauf({ saison: "s1", epreuve: "", m: "x" }, ["m"])).toBe("saison=s1")
    expect(parametresSauf({ saison: "s1", epreuve: "e1", membre: "p1" }, ["epreuve"])).toBe("saison=s1&membre=p1")
  })
})

describe("pastillesFiltres", () => {
  it("n'a pas de pastille sans filtre, la saison comprise", () => {
    expect(pastillesFiltres({ saison: "s1" }, choix, "/apps/budget/recette")).toEqual([])
  })

  it("retire un seul filtre et garde les autres dans l'adresse", () => {
    const pastilles = pastillesFiltres({ saison: "s1", epreuve: "e1", membre: "p1", m: "x" }, choix, "/apps/budget/recette")
    expect(pastilles.map((pastille) => pastille.libelle)).toEqual(["Rallye du Kochersberg", "Jean Koehling"])
    expect(pastilles[0].retirer).toBe("/apps/budget/recette?saison=s1&membre=p1")
    expect(pastilles[1].retirer).toBe("/apps/budget/recette?saison=s1&epreuve=e1")
  })

  it("nomme un filtre inconnu par défaut, sans planter", () => {
    const pastilles = pastillesFiltres({ categorie: "inconnue" }, choix, "/apps/budget")
    expect(pastilles).toEqual([{ cle: "categorie", libelle: "Catégorie", retirer: "/apps/budget" }])
  })
})
