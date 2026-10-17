import { describe, expect, it } from "vitest"

import { libelleBilan, libelleResultatsAValider, resumerPreparation } from "./widgets"

describe("resumerPreparation", () => {
  it("aucun indice : pas de résumé", () => {
    expect(resumerPreparation([])).toBeNull()
  })

  it("garde le pourcentage le plus bas et la couleur la plus grave", () => {
    expect(
      resumerPreparation([
        { pourcentage: 100, couleur: "vert" },
        { pourcentage: 40, couleur: "orange" },
        { pourcentage: 70, couleur: "rouge" },
      ]),
    ).toEqual({ pourcentage: 40, couleur: "rouge" })
  })

  it("tout vert : 100 vert", () => {
    expect(resumerPreparation([{ pourcentage: 100, couleur: "vert" }])).toEqual({ pourcentage: 100, couleur: "vert" })
  })
})

describe("libelleResultatsAValider", () => {
  it("accorde le libellé au nombre", () => {
    expect(libelleResultatsAValider(0)).toBe("Aucun résultat à valider")
    expect(libelleResultatsAValider(1)).toBe("1 résultat à valider")
    expect(libelleResultatsAValider(3)).toBe("3 résultats à valider")
  })
})

describe("libelleBilan", () => {
  it("donne le bilan de la saison en une ligne", () => {
    expect(libelleBilan({ partis: 3, arrivees: 1, abandons: 1, km: 42.36 })).toBe("3 partis · 1 arrivée · 1 abandon · 42.4 km")
  })

  it("accorde les pluriels", () => {
    expect(libelleBilan({ partis: 1, arrivees: 0, abandons: 0, km: 0 })).toBe("1 parti · 0 arrivée · 0 abandon · 0 km")
  })
})
