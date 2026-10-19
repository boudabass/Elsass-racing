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
  it("dessine droite, avant, arrière et dessus ; la vue gauche reprend le dessin droit en miroir", () => {
    expect(gabaritSaxo.vuesDessinees.map((v) => v.vue)).toEqual(["droite", "gauche", "avant", "arriere", "dessus"])
    expect(gabaritSaxo.vuesDessinees.find((v) => v.vue === "gauche")).toEqual({ vue: "gauche", miroirDe: "droite" })
  })

  it("chaque vue qui n'est pas un miroir a son propre dessin, non vide", () => {
    for (const vue of gabaritSaxo.vuesDessinees) {
      if (vue.miroirDe) {
        expect(vue.dessin).toBeUndefined()
      } else {
        expect(vue.dessin?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })

  it("chaque emplacement d'un gabarit est dans une vue dessinée, et a une forme", () => {
    const dessinees = new Set(gabaritSaxo.vuesDessinees.map((v) => v.vue))
    const hors = gabaritSaxo.emplacementsTypes.filter((e) => !dessinees.has(e.vue))
    expect(hors).toEqual([])
    const sansForme = gabaritSaxo.emplacementsTypes.filter((e) => e.forme === null)
    expect(sansForme).toEqual([])
  })

  it("les ordres vont de 1 à 11, sans trou", () => {
    const ordres = gabaritSaxo.emplacementsTypes.map((e) => e.ordre)
    expect(ordres).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it("la lunette arrière n'a aucun emplacement (une vitre reste libre) et son nom est marqué comme retiré", () => {
    expect(gabaritSaxo.emplacementsTypes.some((e) => e.nom === "Lunette arrière")).toBe(false)
    expect(gabaritSaxo.nomsRetires).toEqual(["Lunette arrière"])
  })

  it("les seuls emplacements symétriques sont ceux du plan qui le sont", () => {
    const symetriques = gabaritSaxo.emplacementsTypes.filter((e) => e.symetrique).map((e) => e.nom)
    expect(symetriques).toEqual(["Portière", "Custode arrière", "Aile avant", "Aile arrière", "Bas de caisse"])
  })

  it("la répartition par vue suit le tableau validé (§3b du brief Déco)", () => {
    const parVue = (vue: string) => gabaritSaxo.emplacementsTypes.filter((e) => e.vue === vue).map((e) => e.nom)
    expect(parVue("droite")).toEqual(["Portière", "Custode arrière", "Aile avant", "Aile arrière", "Bandeau de pare-brise", "Bas de caisse"])
    expect(parVue("avant")).toEqual(["Pare-chocs avant"])
    expect(parVue("arriere")).toEqual(["Hayon", "Pare-chocs arrière"])
    expect(parVue("dessus")).toEqual(["Capot", "Toit"])
  })

  it("les dessins n'utilisent que les rôles de couleur", () => {
    const rolesPermis = ["caisse", "vitre", "roue", "jante", "detail", "sol"]
    for (const vue of gabaritSaxo.vuesDessinees) {
      for (const element of vue.dessin ?? []) {
        expect(rolesPermis).toContain(element.role)
      }
    }
    expect(gabaritSaxo.vuesDessinees[0].dessin?.map((e) => e.type)).toContain("path")
  })
})
