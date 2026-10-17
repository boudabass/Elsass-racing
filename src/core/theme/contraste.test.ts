import { describe, expect, it } from "vitest"

import { ajusterPourFond, contraste, luminance } from "./contraste"
import { variablesDeTeam } from "./variables"

const FOND_SOMBRE = "#0B0B0C"
const FOND_CLAIR = "#FFFFFF"

describe("contraste WCAG", () => {
  it("noir sur blanc donne 21:1", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 0)
  })

  it("une couleur sur elle-même donne 1:1", () => {
    expect(contraste("#808080", "#808080")).toBeCloseTo(1, 5)
  })

  it("la luminance du blanc vaut 1 et celle du noir 0", () => {
    expect(luminance("#FFFFFF")).toBeCloseTo(1, 5)
    expect(luminance("#000000")).toBe(0)
  })
})

describe("ajustement des couleurs de team", () => {
  it("éclaircit un rouge sombre sur fond sombre jusqu'à 4,5:1", () => {
    const ajuste = ajusterPourFond("#5A0000", FOND_SOMBRE)
    expect(ajuste).not.toBe("#5A0000")
    expect(contraste(ajuste, FOND_SOMBRE)).toBeGreaterThanOrEqual(4.5)
  })

  it("assombrit un jaune pâle sur fond clair jusqu'à 4,5:1", () => {
    const ajuste = ajusterPourFond("#FFF9C4", FOND_CLAIR)
    expect(ajuste).not.toBe("#FFF9C4")
    expect(contraste(ajuste, FOND_CLAIR)).toBeGreaterThanOrEqual(4.5)
  })

  it("laisse inchangée une couleur déjà lisible sur le fond", () => {
    expect(ajusterPourFond("#F4F3F1", FOND_SOMBRE)).toBe("#F4F3F1")
  })

  it("le rouge par défaut de la team demande un éclaircissement sur fond sombre", () => {
    const ajuste = ajusterPourFond("#D7141A", FOND_SOMBRE)
    expect(contraste(ajuste, FOND_SOMBRE)).toBeGreaterThanOrEqual(4.5)
  })
})

describe("texte sur la couleur de marque", () => {
  // Couleurs de team à tester : rouge par défaut, bleu, noir, jaune.
  const TEAMS = ["#D7141A", "#1E40AF", "#000000", "#FFD400"]

  it.each(TEAMS)("%s : le texte retenu atteint 4,5:1 sur la marque, en clair et en sombre", (principale) => {
    const variables = variablesDeTeam({ couleurPrincipale: principale, couleurSecondaire: null })
    const sombre = contraste(variables["--marque-texte-sombre"], variables["--marque-sombre"])
    const clair = contraste(variables["--marque-texte-clair"], variables["--marque-clair"])
    expect(sombre).toBeGreaterThanOrEqual(4.5)
    expect(clair).toBeGreaterThanOrEqual(4.5)
  })
})
