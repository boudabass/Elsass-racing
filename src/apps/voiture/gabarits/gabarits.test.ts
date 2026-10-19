import { describe, expect, it } from "vitest"

import { CLE_GABARIT_GENERIQUE, GABARITS, gabarit } from "./index"
import { gabaritGenerique } from "./generique"
import { gabaritSaxo } from "./saxo"

// Un chemin droit à quatre sommets (M, L, L, L, Z) forme un rectangle s'il ne prend que deux abscisses et deux ordonnées.
function estRectangle(d: string): boolean {
  const nombres = d.match(/[\d.]+/g)?.map(Number) ?? []
  if (nombres.length !== 8 || !/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/.test(d)) return false
  const xs = new Set(nombres.filter((_, i) => i % 2 === 0))
  const ys = new Set(nombres.filter((_, i) => i % 2 === 1))
  return xs.size === 2 && ys.size === 2
}

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

  it("les vues avant, arrière et dessus sont dessinées en courbes, pas en rectangles", () => {
    for (const vue of ["avant", "arriere", "dessus"] as const) {
      const dessin = gabaritSaxo.vuesDessinees.find((v) => v.vue === vue)?.dessin ?? []
      const courbes = dessin.filter((e) => e.type === "path" && /[QCA]/.test(String(e.attributs.d)))
      expect(courbes.length, vue).toBeGreaterThan(3)
      // Aucun rectangle aligné sur les axes (le bandeau de pare-brise, lui, est un trapèze voulu).
      const rectangles = dessin.filter((e) => e.type === "path" && !/[QCA]/.test(String(e.attributs.d)) && estRectangle(String(e.attributs.d)))
      expect(rectangles.map((e) => e.attributs.d), vue).toEqual([])
    }
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

describe("gabarit Voiture générique", () => {
  it("est le modèle par défaut : premier du catalogue, retrouvé par sa clé", () => {
    expect(GABARITS[0].cle).toBe(CLE_GABARIT_GENERIQUE)
    expect(gabarit(CLE_GABARIT_GENERIQUE)?.nom).toBe("Voiture générique")
  })

  it("porte les 11 emplacements validés, ordres 1 à 11 sans trou", () => {
    const noms = gabaritGenerique.emplacementsTypes.map((e) => e.nom)
    expect(new Set(noms)).toEqual(
      new Set([
        "Portière",
        "Custode arrière",
        "Aile avant",
        "Aile arrière",
        "Bas de caisse",
        "Bandeau de pare-brise",
        "Capot",
        "Hayon",
        "Toit",
        "Pare-chocs avant",
        "Pare-chocs arrière",
      ]),
    )
    expect(noms).toHaveLength(11)
    expect(gabaritGenerique.emplacementsTypes.map((e) => e.ordre)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it("n'a aucun emplacement sur la lunette arrière, et chaque emplacement est dans une vue dessinée avec une forme", () => {
    expect(gabaritGenerique.emplacementsTypes.some((e) => /lunette/i.test(e.nom))).toBe(false)
    const dessinees = new Set(gabaritGenerique.vuesDessinees.map((v) => v.vue))
    expect(gabaritGenerique.emplacementsTypes.filter((e) => !dessinees.has(e.vue) || e.forme === null)).toEqual([])
  })

  it("seuls les emplacements par paire sont symétriques", () => {
    const symetriques = gabaritGenerique.emplacementsTypes.filter((e) => e.symetrique).map((e) => e.nom)
    expect(new Set(symetriques)).toEqual(new Set(["Portière", "Custode arrière", "Aile avant", "Aile arrière", "Bas de caisse"]))
  })
})
