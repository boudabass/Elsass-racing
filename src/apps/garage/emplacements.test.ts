import { describe, expect, it } from "vitest"

import { emplacementsDuType, EMPLACEMENTS_PAR_TYPE, nombreEmplacementsParDefaut, POSITION_TRAIN, POSITION_UNIQUE } from "./emplacements"
import { TYPES_DEFAUT } from "./types-defaut"

describe("emplacements des organes par défaut", () => {
  it("chaque type par défaut a sa liste d'emplacements", () => {
    for (const type of TYPES_DEFAUT) {
      expect(EMPLACEMENTS_PAR_TYPE[type.cle], type.cle).toBeDefined()
    }
  })

  it("le nombre d'emplacements par type suit le brief : moteur, boîte, embrayage 1 ; transmissions 2 ; freins et amortisseurs 4 ; pneus 1", () => {
    expect(emplacementsDuType("moteur")).toHaveLength(1)
    expect(emplacementsDuType("boite")).toHaveLength(1)
    expect(emplacementsDuType("embrayage")).toHaveLength(1)
    expect(emplacementsDuType("transmissions")).toHaveLength(2)
    expect(emplacementsDuType("freins")).toHaveLength(4)
    expect(emplacementsDuType("amortisseurs")).toHaveLength(4)
    expect(emplacementsDuType("pneus")).toHaveLength(1)
  })

  it("une voiture équipée des organes par défaut a quatorze emplacements", () => {
    expect(nombreEmplacementsParDefaut()).toBe(14)
  })

  it("les positions sont uniques à l'intérieur d'un type", () => {
    for (const [cle, liste] of Object.entries(EMPLACEMENTS_PAR_TYPE)) {
      const positions = liste.map((emplacement) => emplacement.position)
      expect(new Set(positions).size, cle).toBe(positions.length)
    }
  })

  it("les types à un seul emplacement utilisent la position unique, et le pneu le train", () => {
    expect(emplacementsDuType("moteur")[0].position).toBe(POSITION_UNIQUE)
    expect(emplacementsDuType("pneus")[0].position).toBe(POSITION_TRAIN)
  })

  it("un type inconnu, une clé absente ou la team n'ont pas d'emplacement", () => {
    expect(emplacementsDuType(null)).toEqual([])
    expect(emplacementsDuType("type_de_la_team")).toEqual([])
  })
})
