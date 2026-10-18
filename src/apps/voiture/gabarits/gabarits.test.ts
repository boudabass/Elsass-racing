import { describe, expect, it } from "vitest"

import { GABARITS, gabarit } from "./index"
import { gabaritSaxo } from "./saxo"

describe("catalogue des gabarits", () => {
  it("les clés sont uniques", () => {
    const cles = GABARITS.map((g) => g.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it("la Saxo est retrouvée par sa clé, et une clé inconnue ne renvoie rien", () => {
    expect(gabarit("citadine_3p_saxo")?.nom).toBe("Citadine 3 portes (Saxo)")
    expect(gabarit("inconnu")).toBeNull()
  })
})

describe("gabarit Saxo", () => {
  it("a une vue droite et une vue gauche en miroir", () => {
    expect(gabaritSaxo.vuesDessinees).toEqual([{ vue: "droite" }, { vue: "gauche", miroirDe: "droite" }])
  })

  it("chaque emplacement d'une vue dessinée a une forme", () => {
    const dessinees = new Set(gabaritSaxo.vuesDessinees.map((v) => v.vue))
    const sansForme = gabaritSaxo.emplacementsTypes.filter((e) => dessinees.has(e.vue) && e.forme === null)
    expect(sansForme).toEqual([])
  })

  it("aucun emplacement hors plan n'a de forme", () => {
    const horsPlan = gabaritSaxo.emplacementsTypes.filter((e) => e.vue === "hors_plan")
    expect(horsPlan.length).toBeGreaterThan(0)
    expect(horsPlan.filter((e) => e.forme !== null)).toEqual([])
  })

  it("les ordres vont de 1 à 10, dans l'ordre de la légende du dossier", () => {
    const ordres = gabaritSaxo.emplacementsTypes.map((e) => e.ordre)
    expect(ordres).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it("les seuls emplacements symétriques sont ceux du plan qui le sont", () => {
    const symetriques = gabaritSaxo.emplacementsTypes.filter((e) => e.symetrique).map((e) => e.nom)
    expect(symetriques).toEqual(["Portière", "Custode arrière", "Aile avant", "Aile arrière", "Bas de caisse"])
  })

  it("le dessin n'utilise que les rôles de couleur", () => {
    const rolesPermis = ["caisse", "vitre", "roue", "jante", "detail", "sol"]
    for (const element of gabaritSaxo.dessin) {
      expect(rolesPermis).toContain(element.role)
    }
    expect(gabaritSaxo.dessin.map((e) => e.type)).toContain("path")
  })
})
