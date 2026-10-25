import { describe, expect, it } from "vitest"

import {
  emplacementsDuType,
  EMPLACEMENTS_PAR_TYPE,
  libellePosition,
  nombreEmplacementsParDefaut,
  nomAvecPosition,
  POSITION_TRAIN,
  POSITION_UNIQUE,
} from "./emplacements"
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

describe("libellé de la position à l'écran", () => {
  it("une clé d'emplacement s'écrit en français : « avant gauche », « gauche »", () => {
    expect(libellePosition("avant_gauche")).toBe("avant gauche")
    expect(libellePosition("arriere_droit")).toBe("arrière droit")
    expect(libellePosition("gauche")).toBe("gauche")
  })

  it("« unique » et « train » ne s'écrivent pas : rien à afficher", () => {
    expect(libellePosition(POSITION_UNIQUE)).toBeNull()
    expect(libellePosition(POSITION_TRAIN)).toBeNull()
    expect(libellePosition(null)).toBeNull()
  })

  it("une position saisie par la team reste telle quelle", () => {
    expect(libellePosition("Arrière, côté passager")).toBe("Arrière, côté passager")
  })
})

describe("nom d'un organe avec sa position", () => {
  it("un organe à plusieurs emplacements se distingue : « Freins · avant gauche »", () => {
    expect(nomAvecPosition("Freins", "avant_gauche")).toBe("Freins · avant gauche")
    expect(nomAvecPosition("Transmissions", "droite")).toBe("Transmissions · droite")
  })

  it("un organe unique ou un train garde son nom seul", () => {
    expect(nomAvecPosition("Moteur", POSITION_UNIQUE)).toBe("Moteur")
    expect(nomAvecPosition("Pneus", POSITION_TRAIN)).toBe("Pneus")
    expect(nomAvecPosition("Freins", null)).toBe("Freins")
  })
})
