import { describe, expect, it } from "vitest"

import { pourcentage } from "./mise-en-forme"
import { libelleFiabilite, libelleLivraisons, libelleTravaux, libelleZonesRouges } from "./widgets"

describe("libelleFiabilite", () => {
  it("donne le mot de la zone et le pourcentage, sans couleur seule", () => {
    expect(libelleFiabilite(85)).toBe(`Bon · ${pourcentage(85)}`)
    expect(libelleFiabilite(20)).toBe(`À surveiller · ${pourcentage(20)}`)
    expect(libelleFiabilite(5)).toBe(`Zone rouge · ${pourcentage(5)}`)
  })

  it("dit « pas encore suivi » sans atelier", () => {
    expect(libelleFiabilite(null)).toBe("Pas encore suivi")
  })
})

describe("libelleZonesRouges", () => {
  it("dit l'absence, puis le compte avant et après l'épreuve", () => {
    expect(libelleZonesRouges(0, null)).toBe("Aucun organe en zone rouge")
    expect(libelleZonesRouges(1, null)).toBe("1 organe en zone rouge")
    expect(libelleZonesRouges(2, 0)).toBe("2 organes en zone rouge · 0 après l'épreuve")
  })
})

describe("libelleTravaux", () => {
  it("accorde le pluriel des travaux prévus", () => {
    expect(libelleTravaux(1, 1)).toBe("1 en cours · 1 prévu")
    expect(libelleTravaux(0, 3)).toBe("0 en cours · 3 prévus")
  })
})

describe("libelleLivraisons", () => {
  it("sans livraison attendue, le dit ; avec, donne la prochaine date", () => {
    expect(libelleLivraisons(0, null)).toBe("Aucune livraison attendue")
    expect(libelleLivraisons(1, null)).toBe("1 attendue")
    expect(libelleLivraisons(2, new Date("2026-11-03T12:00:00Z"))).toMatch(/^2 attendues · prochaine le 3 /)
  })
})
