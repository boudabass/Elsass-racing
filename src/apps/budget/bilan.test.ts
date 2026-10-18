import { describe, expect, it } from "vitest"

import { bilanSaison, type EntreesBilan, type MouvementBilan } from "./bilan"

const depense = (montant: number, categorieId = "peage", valide = true): MouvementBilan => ({
  type: "depense",
  montant,
  categorieId,
  categorieNom: categorieId === "peage" ? "Péages" : categorieId === "pneus" ? "Pneus" : "Autre",
  valide,
})

const recette = (montant: number, valide = true, categorieId = "partenaire"): MouvementBilan => ({
  type: "recette",
  montant,
  categorieId,
  categorieNom: "Partenaire",
  valide,
})

const vide: EntreesBilan = { mouvements: [], previsions: [], epreuves: [], membres: [] }

describe("bilanSaison : totaux", () => {
  it("additionne les dépenses confirmées et les recettes encaissées, et calcule le solde", () => {
    const bilan = bilanSaison({
      ...vide,
      mouvements: [depense(1000), depense(2500), recette(5000)],
    })
    expect(bilan.chiffres.depensesConfirmees).toBe(3500)
    expect(bilan.chiffres.recettesEncaissees).toBe(5000)
    expect(bilan.chiffres.solde).toBe(1500)
  })

  it("donne un solde négatif quand les dépenses dépassent les recettes", () => {
    const bilan = bilanSaison({ ...vide, mouvements: [depense(4000), recette(1000)] })
    expect(bilan.chiffres.solde).toBe(-3000)
  })
})

describe("bilanSaison : propositions", () => {
  it("ne compte pas une dépense à confirmer dans les totaux, mais la signale", () => {
    const bilan = bilanSaison({ ...vide, mouvements: [depense(1000), depense(700, "peage", false)] })
    expect(bilan.chiffres.depensesConfirmees).toBe(1000)
    expect(bilan.depensesParCategorie.map((ligne) => ligne.montant)).toEqual([1000])
    expect(bilan.propositions).toEqual({ nombre: 1, montant: 700 })
  })
})

describe("bilanSaison : recettes", () => {
  it("met les recettes prévues non encaissées sur une ligne à part, sans toucher au solde", () => {
    const bilan = bilanSaison({ ...vide, mouvements: [recette(5000), recette(3000, false)] })
    expect(bilan.recettes.parCategorie).toEqual([{ categorieId: "partenaire", nom: "Partenaire", montant: 5000 }])
    expect(bilan.recettes.aVenir).toBe(3000)
    expect(bilan.chiffres.recettesEncaissees).toBe(5000)
    expect(bilan.chiffres.solde).toBe(5000)
  })
})

describe("bilanSaison : dépenses par catégorie", () => {
  it("donne la part du total, le prévu et l'écart, triées par montant décroissant", () => {
    const bilan = bilanSaison({
      ...vide,
      mouvements: [depense(1000, "pneus"), depense(3000, "peage")],
      previsions: [{ categorieId: "peage", montant: 2000 }],
    })
    expect(bilan.depensesParCategorie).toEqual([
      { categorieId: "peage", nom: "Péages", montant: 3000, part: 75, prevu: 2000, ecart: 1000 },
      { categorieId: "pneus", nom: "Pneus", montant: 1000, part: 25, prevu: null, ecart: null },
    ])
  })

  it("exclut les catégories à zéro, même quand elles ont un prévu", () => {
    const bilan = bilanSaison({
      ...vide,
      mouvements: [depense(0, "pneus"), depense(1000, "peage")],
      previsions: [{ categorieId: "pneus", montant: 500 }],
    })
    expect(bilan.depensesParCategorie.map((ligne) => ligne.categorieId)).toEqual(["peage"])
  })
})

describe("bilanSaison : prévisionnel", () => {
  it("additionne le prévisionnel des dépenses, ou donne null s'il n'y en a pas", () => {
    expect(bilanSaison({ ...vide, previsions: [{ categorieId: "peage", montant: 2000 }, { categorieId: "pneus", montant: 500 }] }).chiffres.previsionDepenses).toBe(2500)
    expect(bilanSaison(vide).chiffres.previsionDepenses).toBeNull()
  })
})

describe("bilanSaison : épreuves et membres", () => {
  it("range les coûts par épreuve par date, sans les recalculer", () => {
    const bilan = bilanSaison({
      ...vide,
      epreuves: [
        { id: "b", nom: "Slalom", date: "2026-06-20", total: 900 },
        { id: "a", nom: "Rallye", date: "2026-05-10", total: 4500 },
      ],
    })
    expect(bilan.coutsParEpreuve.map((epreuve) => [epreuve.nom, epreuve.total])).toEqual([
      ["Rallye", 4500],
      ["Slalom", 900],
    ])
  })

  it("reprend les avances des membres telles quelles, reste dû compris", () => {
    const bilan = bilanSaison({
      ...vide,
      membres: [{ nom: "Jo", avance: 8000, rembourse: 3000, du: 5000, trop: 0 }],
    })
    expect(bilan.avancesMembres).toEqual([{ nom: "Jo", avance: 8000, rembourse: 3000, resteDu: 5000, trop: 0 }])
  })
})

describe("bilanSaison : saison vide", () => {
  it("donne des zéros, des listes vides et le drapeau « aucun mouvement »", () => {
    const bilan = bilanSaison(vide)
    expect(bilan.chiffres).toEqual({ depensesConfirmees: 0, recettesEncaissees: 0, solde: 0, previsionDepenses: null })
    expect(bilan.depensesParCategorie).toEqual([])
    expect(bilan.recettes).toEqual({ parCategorie: [], aVenir: 0 })
    expect(bilan.propositions).toEqual({ nombre: 0, montant: 0 })
    expect(bilan.aucunMouvement).toBe(true)
  })
})
