import { describe, expect, it } from "vitest"

import { libelleEmplacementsLibres, libellePapiersARenouveler } from "./libelles"
import { papiersARenouveler } from "./regles"

const maintenant = new Date("2032-03-10T10:00:00Z")
const jour = (date: string) => new Date(`${date}T00:00:00Z`)

describe("papiers à renouveler (widget)", () => {
  it("ne retient ni les papiers valides, ni les papiers sans échéance", () => {
    const papiers = [
      { id: "valide", valableJusquAu: jour("2033-01-01") },
      { id: "sans-echeance", valableJusquAu: null },
    ]
    expect(papiersARenouveler(papiers, maintenant)).toEqual([])
  })

  it("range les expirés avant les papiers à renouveler, puis par échéance la plus proche", () => {
    const papiers = [
      { id: "a-renouveler-tard", valableJusquAu: jour("2032-04-05") },
      { id: "expire-ancien", valableJusquAu: jour("2032-03-01") },
      { id: "a-renouveler-tot", valableJusquAu: jour("2032-03-20") },
      { id: "expire-recent", valableJusquAu: jour("2032-03-07") },
      { id: "valide", valableJusquAu: jour("2033-01-01") },
    ]
    const ordre = papiersARenouveler(papiers, maintenant).map((papier) => [papier.id, papier.statut])
    expect(ordre).toEqual([
      ["expire-ancien", "expire"],
      ["expire-recent", "expire"],
      ["a-renouveler-tot", "a_renouveler"],
      ["a-renouveler-tard", "a_renouveler"],
    ])
  })

  it("garde les données du papier à côté de son statut", () => {
    const [premier] = papiersARenouveler([{ id: "x", valableJusquAu: jour("2032-03-01") }], maintenant)
    expect(premier).toEqual({ id: "x", valableJusquAu: jour("2032-03-01"), statut: "expire" })
  })
})

describe("libellés des widgets de Voiture", () => {
  it("accorde les papiers à renouveler", () => {
    expect(libellePapiersARenouveler(0)).toBe("Aucun papier à renouveler")
    expect(libellePapiersARenouveler(1)).toBe("1 papier à renouveler")
    expect(libellePapiersARenouveler(3)).toBe("3 papiers à renouveler")
  })

  it("accorde les emplacements libres", () => {
    expect(libelleEmplacementsLibres(0)).toBe("Aucun emplacement libre")
    expect(libelleEmplacementsLibres(1)).toBe("1 emplacement libre")
    expect(libelleEmplacementsLibres(2)).toBe("2 emplacements libres")
  })
})
