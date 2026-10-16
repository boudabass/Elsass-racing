import { describe, expect, it } from "vitest"

import { initialesTeam } from "./initiales"

describe("initialesTeam", () => {
  it("prend la première lettre des deux premiers mots", () => {
    expect(initialesTeam("Koehling Racing Team")).toBe("KR")
  })

  it("donne la même lettre partout pour une team de test", () => {
    expect(initialesTeam("E2E mvb5dhdf")).toBe("EM")
  })

  it("ignore les mots faits uniquement de chiffres", () => {
    expect(initialesTeam("2026 Racing")).toBe("R")
  })

  it("ignore les petits mots", () => {
    expect(initialesTeam("Le Rallye des Vosges")).toBe("RV")
    expect(initialesTeam("Team de la Plaine")).toBe("TP")
  })

  it("retire l'élision devant le mot", () => {
    expect(initialesTeam("Team d'Alsace")).toBe("TA")
    expect(initialesTeam("l' Écurie")).toBe("É")
  })

  it("prend ce qui existe pour un seul mot", () => {
    expect(initialesTeam("Koehling")).toBe("K")
  })

  it("retombe sur ER sans lettre utile", () => {
    expect(initialesTeam("   ")).toBe("ER")
    expect(initialesTeam("2026")).toBe("ER")
  })
})
