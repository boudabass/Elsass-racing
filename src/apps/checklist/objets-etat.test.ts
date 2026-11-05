import { describe, expect, it } from "vitest"

import { dateLongue, echeanceEnClair, etatEcheance } from "./objets-etat"

describe("état d'une échéance lié (5.7a)", () => {
  const fin = new Date("2026-11-03T00:00:00Z")

  it("sans date de fin : pas d'alerte, quel que soit le statut", () => {
    expect(etatEcheance("valide", null)).toEqual({ etat: "Sans date de fin", alerte: false })
  })

  it("valide : la date est dans le texte, pas d'alerte", () => {
    const resultat = etatEcheance("valide", fin)
    expect(resultat.alerte).toBe(false)
    expect(resultat.etat).toContain("Valable jusqu'au 3 novembre 2026")
  })

  it("à renouveler et expiré : alerte, et le texte le dit", () => {
    expect(etatEcheance("a_renouveler", fin)).toEqual({ etat: "À renouveler, valable jusqu'au 3 novembre 2026", alerte: true })
    expect(etatEcheance("expire", fin)).toEqual({ etat: "Expiré le 3 novembre 2026", alerte: true })
  })

  it("la date se lit en calendrier UTC (dates de la base, sans décalage)", () => {
    expect(dateLongue(new Date("2026-01-01T00:00:00Z"))).toBe("1 janvier 2026")
  })
})

describe("échéance d'un point critique dite au jour de l'écriture (5.8)", () => {
  it("sans échéance : non fixée", () => {
    expect(echeanceEnClair(null, "2026-11-05")).toBe("échéance non fixée")
  })

  it("à venir : le jour, en toutes lettres", () => {
    expect(echeanceEnClair("2026-10-29", "2026-10-20")).toBe("échéance le 29 octobre 2026")
  })

  it("le jour même : aujourd'hui", () => {
    expect(echeanceEnClair("2026-11-05", "2026-11-05")).toBe("échéance aujourd'hui")
  })

  it("passée : dépassée depuis le jour", () => {
    expect(echeanceEnClair("2026-10-29", "2026-11-05")).toBe("échéance dépassée depuis le 29 octobre 2026")
  })

  it("le contexte change quand le jour change : une réémission a alors quelque chose à réécrire", () => {
    expect(echeanceEnClair("2026-11-06", "2026-11-05")).not.toBe(echeanceEnClair("2026-11-06", "2026-11-06"))
  })
})
