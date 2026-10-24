import { describe, expect, it } from "vitest"

import { kmPrevusDesSpeciales } from "./avant-epreuve"

describe("kmPrevusDesSpeciales", () => {
  it("sans spéciale, ou sans aucune longueur saisie : rien n'est prévu", () => {
    expect(kmPrevusDesSpeciales([])).toBeNull()
    expect(kmPrevusDesSpeciales([{ longueurKm: null, nbPassages: 2 }])).toBeNull()
  })

  it("longueur × passages, un passage si le nombre est vide", () => {
    expect(kmPrevusDesSpeciales([{ longueurKm: 10, nbPassages: 2 }, { longueurKm: 5, nbPassages: null }])).toBe(25)
  })

  it("une spéciale sans longueur ne compte pas, les autres comptent", () => {
    expect(kmPrevusDesSpeciales([{ longueurKm: null, nbPassages: 3 }, { longueurKm: 4.5, nbPassages: 2 }])).toBe(9)
  })
})
