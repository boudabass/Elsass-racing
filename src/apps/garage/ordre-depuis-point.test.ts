import { describe, expect, it } from "vitest"

import { BOUTONS_ORDRE_DEPUIS_POINT, titreProbleme } from "./ordre-depuis-point"

describe("proposition d'ordre depuis un point (5.7a)", () => {
  it("le titre se construit depuis le nom de l'organe, jamais depuis le libellé du point", () => {
    expect(titreProbleme("Freins, avant gauche")).toBe("Problème signalé : Freins, avant gauche")
  })

  it("deux boutons : créer l'ordre, ou ignorer (qui ne fait rien)", () => {
    expect(BOUTONS_ORDRE_DEPUIS_POINT.map((bouton) => bouton.cle)).toEqual(["accepter", "ignorer"])
  })

  // « Ouvrir » ferait croire à une navigation : le bouton crée l'ordre, il ne l'ouvre pas (décision de l'orchestrateur, 05/11).
  it("le bouton d'acceptation s'appelle « Créer l'ordre », jamais « Ouvrir l'ordre »", () => {
    expect(BOUTONS_ORDRE_DEPUIS_POINT.map((bouton) => bouton.libelle)).toEqual(["Créer l'ordre", "Ignorer"])
  })
})
