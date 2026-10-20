import { describe, expect, it } from "vitest"

import {
  enumererOrganes,
  libelleZone,
  motIndice,
  ordreDesOrganes,
  phraseKmRestants,
  phraseManque,
  pourcentage,
  zoneIndice,
  type OrganeMot,
} from "./mise-en-forme"

const organe = (nom: string, zone: OrganeMot["zone"], extra: Partial<OrganeMot> = {}): OrganeMot => ({
  nom,
  critique: true,
  pieceMontee: true,
  zone,
  ...extra,
})

describe("mot de l'indice", () => {
  it("sans organe critique renseigné, « À renseigner »", () => {
    expect(motIndice([])).toBe("À renseigner")
    expect(motIndice([organe("Freins", "a_renseigner")])).toBe("À renseigner")
    expect(motIndice([organe("Transmissions", "vert", { pieceMontee: false })])).toBe("À renseigner")
  })

  it("tous vert, « Bon »", () => {
    expect(motIndice([organe("Moteur", "vert"), organe("Freins", "vert")])).toBe("Bon")
  })

  it("un rouge nomme l'organe : « À changer : embrayage »", () => {
    expect(motIndice([organe("Moteur", "vert"), organe("Embrayage", "rouge")])).toBe("À changer : embrayage")
  })

  it("plusieurs rouges se comptent : « embrayage et 1 autre », « et 2 autres »", () => {
    const deux = [organe("Embrayage", "rouge"), organe("Freins", "rouge"), organe("Moteur", "vert")]
    expect(motIndice(deux)).toBe("À changer : embrayage et 1 autre")
    const trois = [...deux, organe("Boîte de vitesses", "rouge")]
    expect(motIndice(trois)).toBe("À changer : embrayage et 2 autres")
  })

  it("un orange, sans rouge : « À surveiller : boîte de vitesses »", () => {
    expect(motIndice([organe("Moteur", "vert"), organe("Boîte de vitesses", "orange")])).toBe("À surveiller : boîte de vitesses")
  })

  it("le rouge l'emporte sur l'orange, qui n'est pas nommé", () => {
    const organes = [organe("Boîte de vitesses", "orange"), organe("Embrayage", "rouge")]
    expect(motIndice(organes)).toBe("À changer : embrayage")
  })

  it("un organe non critique, ou sans pièce montée, ne compte pas", () => {
    expect(motIndice([organe("Amortisseurs", "rouge", { critique: false }), organe("Moteur", "vert")])).toBe("Bon")
    expect(motIndice([organe("Transmissions", "rouge", { pieceMontee: false }), organe("Moteur", "vert")])).toBe("Bon")
  })

  it("l'exemple de la capture : 34 % et « À changer : embrayage »", () => {
    const capture = [
      organe("Moteur", "vert"),
      organe("Boîte de vitesses", "orange"),
      organe("Embrayage", "rouge"),
      organe("Amortisseurs", "vert", { critique: false }),
    ]
    expect(motIndice(capture)).toBe("À changer : embrayage")
  })

  it("enumererOrganes : un nom seul, puis le premier et le nombre d'autres", () => {
    expect(enumererOrganes(["Moteur"])).toBe("Moteur")
    expect(enumererOrganes(["Moteur", "Freins"])).toBe("Moteur et 1 autre")
    expect(enumererOrganes(["Moteur", "Freins", "Pneus"])).toBe("Moteur et 2 autres")
  })
})

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
