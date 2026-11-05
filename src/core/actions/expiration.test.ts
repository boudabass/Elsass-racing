import { describe, expect, it } from "vitest"

import { estExpiree, limiteExpiration } from "./expiration"
import { prioriteEcheance, PRIORITE, TYPES_A_ECHEANCE, TYPES_OBLIGATION } from "./priorites"

const MAINTENANT = new Date("2026-11-05T10:00:00.000Z")
const jours = (n: number) => new Date(MAINTENANT.getTime() - n * 24 * 60 * 60 * 1000)

describe("expiration d'une action à échéance : 30 jours après la date", () => {
  it("une échéance plus vieille de 30 jours est expirée, une échéance plus récente ne l'est pas", () => {
    expect(estExpiree(jours(31), MAINTENANT)).toBe(true)
    expect(estExpiree(jours(29), MAINTENANT)).toBe(false)
  })

  it("exactement 30 jours : l'action reste", () => {
    expect(estExpiree(jours(30), MAINTENANT)).toBe(false)
    expect(limiteExpiration(MAINTENANT).getTime()).toBe(jours(30).getTime())
  })

  it("une action sans échéance n'expire jamais", () => {
    expect(estExpiree(null, MAINTENANT)).toBe(false)
  })
})

describe("types à échéance et obligations (5.8, option c)", () => {
  it("la clôture des engagements porte une échéance : elle expire 30 jours après", () => {
    expect(TYPES_A_ECHEANCE).toContain("cloture_engagements")
    expect(estExpiree(jours(31), MAINTENANT)).toBe(true)
  })

  it("les obligations ne portent pas d'échéance d'action : elles n'expirent pas", () => {
    for (const type of TYPES_OBLIGATION) {
      expect(TYPES_A_ECHEANCE).not.toContain(type)
    }
    expect(estExpiree(null, MAINTENANT)).toBe(false)
  })

  it("une obligation dont la date est passée depuis plus de 30 jours garde le rang 2 le jour J et après", () => {
    // Le rang suit la date de la fiche (prioriteEcheance à chaque émission), sans échéance sur l'action.
    expect(prioriteEcheance(jours(0), MAINTENANT)).toBe(PRIORITE.echeance_depassee)
    expect(prioriteEcheance(jours(45), MAINTENANT)).toBe(PRIORITE.echeance_depassee)
  })

  it("une obligation à venir garde le rang 9 jusqu'au jour J", () => {
    expect(prioriteEcheance(new Date("2026-11-20T00:00:00.000Z"), MAINTENANT)).toBe(PRIORITE.echeance_proche)
  })
})
