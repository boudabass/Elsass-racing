import { describe, expect, it } from "vitest"

import { BOUTONS_ORDRE_DEPUIS_POINT, titreProbleme } from "./ordre-depuis-point"

describe("proposition d'ordre depuis un point (5.7a)", () => {
  it("le titre se construit depuis le nom de l'organe, jamais depuis le libellé du point", () => {
    expect(titreProbleme("Freins, avant gauche")).toBe("Problème signalé : Freins, avant gauche")
  })

  it("deux boutons : ouvrir l'ordre, ou ignorer (qui ne fait rien)", () => {
    expect(BOUTONS_ORDRE_DEPUIS_POINT.map((bouton) => bouton.cle)).toEqual(["accepter", "ignorer"])
  })
})
