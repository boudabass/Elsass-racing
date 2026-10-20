import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  additionnerKm,
  dureesEffectives,
  etatPiece,
  etatPneus,
  fiabiliteChangee,
  franchitZoneRouge,
  indiceFiabilite,
  kmRestantsAvantRouge,
  SEUILS_DEFAUT,
  seuilsValides,
  zoneDeEtat,
} from "./regles"

describe("additionnerKm (correction A : décimaux sans dérive)", () => {
  it("garde le dixième exact : 0,1 + 0,2 vaut 0,3", () => {
    expect(additionnerKm(0.1, 0.2)).toBe(0.3)
  })

  it("accumule 12,3 km sur trois épreuves sans arrondi à l'entier", () => {
    let total = 0
    for (const ajout of [4.1, 4.1, 4.1]) total = additionnerKm(total, ajout)
    expect(total).toBe(12.3)
  })
})

describe("dureesEffectives", () => {
  it("prend la durée de la pièce quand elle est saisie, sinon celle de l'organe", () => {
    const organe = { km: 100, epreuves: 6 }
    expect(dureesEffectives({ km: 80, epreuves: null }, organe)).toEqual({ km: 80, epreuves: 6 })
  })

  it("renvoie null quand ni la pièce ni l'organe ne la renseignent", () => {
    expect(dureesEffectives({ km: null, epreuves: null }, { km: null, epreuves: 4 })).toEqual({ km: null, epreuves: 4 })
  })
})

describe("etatPiece", () => {
  it("mode km : 100 moins km ÷ durée", () => {
    expect(etatPiece("km", { km: 100, epreuves: null }, { km: 25, epreuves: 0 })).toBe(75)
  })

  it("mode km avec des km à virgule : 12,3 km sur 100 donnent 87,7 %", () => {
    expect(etatPiece("km", { km: 100, epreuves: null }, { km: 12.3, epreuves: 3 })).toBeCloseTo(87.7, 10)
  })

  it("mode épreuves : 12,3 km sur trois épreuves ne comptent que les épreuves (3 sur 6 donnent 50 %)", () => {
    expect(etatPiece("epreuves", { km: 100, epreuves: 6 }, { km: 12.3, epreuves: 3 })).toBe(50)
  })

  it("mode les deux : le plus bas des deux (km 87,7 %, épreuves 50 % donnent 50 %)", () => {
    expect(etatPiece("les_deux", { km: 100, epreuves: 6 }, { km: 12.3, epreuves: 3 })).toBe(50)
  })

  it("borné à 0 : une pièce usée au-delà de sa vie n'est jamais négative", () => {
    expect(etatPiece("km", { km: 100, epreuves: null }, { km: 180, epreuves: 0 })).toBe(0)
  })

  it("renvoie null (à renseigner) quand la durée du mode manque", () => {
    expect(etatPiece("km", { km: null, epreuves: 6 }, { km: 10, epreuves: 1 })).toBeNull()
    expect(etatPiece("epreuves", { km: 100, epreuves: null }, { km: 10, epreuves: 1 })).toBeNull()
  })

  it("mode les deux exige les deux durées : une seule ne suffit pas", () => {
    expect(etatPiece("les_deux", { km: 100, epreuves: null }, { km: 10, epreuves: 1 })).toBeNull()
  })
})

describe("zoneDeEtat (seuils par défaut 30 et 10)", () => {
  const seuils = { orange: SEUILS_DEFAUT.orange, rouge: SEUILS_DEFAUT.rouge }

  it("bornes comprises : 30 est vert, 29,9 est orange", () => {
    expect(zoneDeEtat(30, seuils)).toBe("vert")
    expect(zoneDeEtat(29.9, seuils)).toBe("orange")
  })

  it("bornes comprises : 10 est orange, 9,9 est rouge", () => {
    expect(zoneDeEtat(10, seuils)).toBe("orange")
    expect(zoneDeEtat(9.9, seuils)).toBe("rouge")
  })

  it("un état inconnu est à renseigner, jamais rouge", () => {
    expect(zoneDeEtat(null, seuils)).toBe("a_renseigner")
  })

  it("respecte des seuils réglés par organe", () => {
    expect(zoneDeEtat(20, { orange: 20, rouge: 5 })).toBe("vert")
    expect(zoneDeEtat(6, { orange: 20, rouge: 5 })).toBe("orange")
  })
})

describe("kmRestantsAvantRouge", () => {
  it("mode km : durée × (1 − seuil rouge) moins l'usure (100 km, seuil 10, 12,3 km donnent 77,7)", () => {
    expect(kmRestantsAvantRouge("km", { km: 100, epreuves: null }, { km: 12.3, epreuves: 0 }, 10)).toBe(77.7)
  })

  it("est null en mode épreuves seul", () => {
    expect(kmRestantsAvantRouge("epreuves", { km: 100, epreuves: 6 }, { km: 12.3, epreuves: 3 }, 10)).toBeNull()
  })

  it("est null sans durée de km", () => {
    expect(kmRestantsAvantRouge("km", { km: null, epreuves: 6 }, { km: 12.3, epreuves: 3 }, 10)).toBeNull()
  })

  it("ne descend jamais sous zéro", () => {
    expect(kmRestantsAvantRouge("km", { km: 100, epreuves: null }, { km: 95, epreuves: 0 }, 10)).toBe(0)
  })
})

describe("indiceFiabilite", () => {
  it("moyenne à poids égaux des organes critiques renseignés qui ont une pièce montée", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "freins", critique: true, pieceMontee: true, etat: 60 },
    ])
    expect(indice).toEqual({ indice: 70, sansPiece: [] })
  })

  it("ignore les organes non critiques (pneus, amortisseurs)", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "pneus", critique: false, pieceMontee: true, etat: 10 },
    ])
    expect(indice.indice).toBe(80)
  })

  it("signale à part un organe critique sans pièce, sans le compter à 0", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "boite", critique: true, pieceMontee: false, etat: null },
    ])
    expect(indice).toEqual({ indice: 80, sansPiece: ["boite"] })
  })

  it("exclut un organe avec pièce mais à renseigner, sans le compter à 0", () => {
    const indice = indiceFiabilite([
      { id: "moteur", critique: true, pieceMontee: true, etat: 80 },
      { id: "embrayage", critique: true, pieceMontee: true, etat: null },
    ])
    expect(indice.indice).toBe(80)
  })

  it("renvoie null s'il n'y a aucun organe retenu", () => {
    expect(indiceFiabilite([{ id: "moteur", critique: true, pieceMontee: false, etat: null }]).indice).toBeNull()
  })
})

describe("franchitZoneRouge", () => {
  it("vrai quand l'état passe de 10 (égal au seuil) à 9,9", () => {
    expect(franchitZoneRouge(10, 9.9, 10)).toBe(true)
  })

  it("faux quand l'état était déjà sous le seuil", () => {
    expect(franchitZoneRouge(9.9, 5, 10)).toBe(false)
  })

  it("faux quand l'état reste au seuil", () => {
    expect(franchitZoneRouge(10, 10, 10)).toBe(false)
  })

  it("faux quand un état est inconnu", () => {
    expect(franchitZoneRouge(null, 5, 10)).toBe(false)
    expect(franchitZoneRouge(20, null, 10)).toBe(false)
  })
})

describe("fiabiliteChangee (indice arrondi à l'unité)", () => {
  it("faux quand l'arrondi ne change pas (70,4 puis 70,2)", () => {
    expect(fiabiliteChangee(70.4, 70.2)).toBe(false)
  })

  it("vrai quand l'arrondi change (70,5 puis 69,9 : 71 puis 70)", () => {
    expect(fiabiliteChangee(70.5, 69.9)).toBe(true)
  })

  it("passer de rien à un indice compte comme un changement", () => {
    expect(fiabiliteChangee(null, 50)).toBe(true)
    expect(fiabiliteChangee(null, null)).toBe(false)
  })
})

describe("etatPneus (correction C)", () => {
  it("100 moins l'usure estimée du train monté", () => {
    expect(etatPneus(true, 40)).toBe(60)
  })

  it("à renseigner sans train monté ou sans usure saisie", () => {
    expect(etatPneus(false, 40)).toBeNull()
    expect(etatPneus(true, null)).toBeNull()
  })

  it("borné à 0", () => {
    expect(etatPneus(true, 120)).toBe(0)
  })
})

describe("seuilsValides", () => {
  it("accepte 0 ≤ rouge < orange ≤ 100", () => {
    expect(seuilsValides({ orange: 30, rouge: 10 })).toBe(true)
    expect(seuilsValides({ orange: 100, rouge: 0 })).toBe(true)
  })

  it("refuse rouge égal ou supérieur à orange, orange au-delà de 100, rouge négatif, valeurs non entières", () => {
    expect(seuilsValides({ orange: 10, rouge: 10 })).toBe(false)
    expect(seuilsValides({ orange: 101, rouge: 10 })).toBe(false)
    expect(seuilsValides({ orange: 30, rouge: -1 })).toBe(false)
    expect(seuilsValides({ orange: 30.5, rouge: 10 })).toBe(false)
  })
})

describe("défauts des seuils, égaux à la migration", () => {
  it("SEUILS_DEFAUT correspond aux défauts de garage_vehicle_component dans le schéma", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8")
    const orange = /seuilOrangePct\s+Int\s+@default\((\d+)\)/.exec(schema)?.[1]
    const rouge = /seuilRougePct\s+Int\s+@default\((\d+)\)/.exec(schema)?.[1]
    expect(Number(orange)).toBe(SEUILS_DEFAUT.orange)
    expect(Number(rouge)).toBe(SEUILS_DEFAUT.rouge)
  })
})
