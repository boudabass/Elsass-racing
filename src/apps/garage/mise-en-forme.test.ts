import { describe, expect, it } from "vitest"

import { libelleZone, ordreDesOrganes, phraseKmRestants, phraseManque, pourcentage, zoneIndice } from "./mise-en-forme"

describe("mot de la zone", () => {
  it("écrit le mot de chaque zone, sur les seuils par défaut des pièces", () => {
    expect(libelleZone("vert")).toBe("Bon")
    expect(libelleZone("orange")).toBe("À surveiller")
    expect(libelleZone("rouge")).toBe("À changer")
    expect(libelleZone("a_renseigner")).toBe("À renseigner")
  })

  it("donne la zone de l'indice : 30 % et 10 % comme seuils, sans indice à renseigner", () => {
    expect(zoneIndice(null)).toBe("a_renseigner")
    expect(zoneIndice(30)).toBe("vert")
    expect(zoneIndice(29.9)).toBe("orange")
    expect(zoneIndice(10)).toBe("orange")
    expect(zoneIndice(9.9)).toBe("rouge")
  })
})

describe("pourcentage", () => {
  it("arrondit à l'entier et ajoute l'espace insécable avant %", () => {
    expect(pourcentage(72.4)).toBe("72 %")
    expect(pourcentage(72.6)).toBe("73 %")
  })

  it("renvoie null sans état", () => {
    expect(pourcentage(null)).toBeNull()
  })
})

describe("ordre des cartes", () => {
  it("met les organes critiques d'abord, en gardant l'ordre des types à l'intérieur de chaque groupe", () => {
    const organes = [
      { nom: "Amortisseurs", critique: false },
      { nom: "Moteur", critique: true },
      { nom: "Éclairage", critique: false },
      { nom: "Freins", critique: true },
    ]
    expect(ordreDesOrganes(organes).map((o) => o.nom)).toEqual(["Moteur", "Freins", "Amortisseurs", "Éclairage"])
  })

  it("ne modifie pas le tableau reçu", () => {
    const organes = [
      { nom: "Éclairage", critique: false },
      { nom: "Moteur", critique: true },
    ]
    ordreDesOrganes(organes)
    expect(organes[0].nom).toBe("Éclairage")
  })
})

describe("phrases de l'atelier", () => {
  it("dit les km restants, ou que la zone rouge est atteinte à zéro", () => {
    expect(phraseKmRestants(null)).toBeNull()
    expect(phraseKmRestants(0)).toBe("Zone rouge atteinte")
    expect(phraseKmRestants(1240.4)).toBe("1 240 km avant la zone rouge")
  })

  it("nomme ce qui manque à l'indice", () => {
    expect(phraseManque([])).toBe("Aucun organe critique sans pièce montée.")
    expect(phraseManque(["Freins", "Moteur"])).toBe("Il manque une pièce montée sur : Freins, Moteur.")
  })
})
