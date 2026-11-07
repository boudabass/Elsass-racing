import { describe, expect, it } from "vitest"

import { engagementAPayer, engagementDansFenetre, rangObligation, type EngagementPourRang } from "./rang-obligation"
import { PRIORITE } from "./priorites"

// 10 mars 2027, 11 h à Paris : le jour civil de référence de tous les tests.
const MAINTENANT = new Date("2027-03-10T10:00:00Z")
const jour = (s: string) => new Date(`${s}T00:00:00Z`)

function engagement(over: Partial<EngagementPourRang> & { debut: string; fin?: string }): EngagementPourRang {
  return {
    eventId: over.eventId ?? "epreuve-a",
    dateDebut: jour(over.debut),
    dateFin: jour(over.fin ?? over.debut),
    annulee: over.annulee ?? false,
    statut: over.statut ?? "inscrit",
  }
}

describe("fenêtre bloquante (J-8, J-7, J0, en cours)", () => {
  it("J+8 : hors de la fenêtre", () => {
    expect(engagementDansFenetre(engagement({ debut: "2027-03-18" }), MAINTENANT)).toBe(false)
  })
  it("J+7 : dans la fenêtre (J+7 compris)", () => {
    expect(engagementDansFenetre(engagement({ debut: "2027-03-17" }), MAINTENANT)).toBe(true)
  })
  it("J0 : dans la fenêtre", () => {
    expect(engagementDansFenetre(engagement({ debut: "2027-03-10" }), MAINTENANT)).toBe(true)
  })
  it("en cours : dans la fenêtre tant que la fin n'est pas passée", () => {
    expect(engagementDansFenetre(engagement({ debut: "2027-03-08", fin: "2027-03-12" }), MAINTENANT)).toBe(true)
  })
  it("finie hier : hors de la fenêtre", () => {
    expect(engagementDansFenetre(engagement({ debut: "2027-03-08", fin: "2027-03-09" }), MAINTENANT)).toBe(false)
  })
})

describe("rangObligation", () => {
  it("licence non valable le jour de l'épreuve, épreuve à J+5 : bloquant, avec l'épreuve", () => {
    const r = rangObligation({ valableJusquAu: jour("2027-03-14") }, [engagement({ debut: "2027-03-15" })], MAINTENANT)
    expect(r).toEqual({ priorite: PRIORITE.bloquant, eventId: "epreuve-a" })
  })

  it("licence qui expire le jour même de l'épreuve : valable ce jour-là, pas bloquant", () => {
    const r = rangObligation({ valableJusquAu: jour("2027-03-15") }, [engagement({ debut: "2027-03-15" })], MAINTENANT)
    expect(r).toBeNull()
  })

  it("fiche valable à la date de l'épreuve, expirée aujourd'hui : pas bloquant", () => {
    const r = rangObligation({ valableJusquAu: jour("2027-03-20") }, [engagement({ debut: "2027-03-15" })], MAINTENANT)
    expect(r).toBeNull()
  })

  it("fiche sans fin : jamais bloquante", () => {
    expect(rangObligation({ valableJusquAu: null }, [engagement({ debut: "2027-03-15" })], MAINTENANT)).toBeNull()
  })

  it("en cours : une fiche qui expire avant le début de l'épreuve est bloquante", () => {
    const r = rangObligation({ valableJusquAu: jour("2027-03-07") }, [engagement({ debut: "2027-03-08", fin: "2027-03-12" })], MAINTENANT)
    expect(r?.priorite).toBe(PRIORITE.bloquant)
  })

  it("épreuve finie : pas bloquant même si la fiche n'est pas valable à la date", () => {
    const r = rangObligation({ valableJusquAu: jour("2027-03-01") }, [engagement({ debut: "2027-03-01", fin: "2027-03-05" })], MAINTENANT)
    expect(r).toBeNull()
  })

  it("épreuve annulée : pas bloquant", () => {
    const r = rangObligation({ valableJusquAu: jour("2027-03-14") }, [engagement({ debut: "2027-03-15", annulee: true })], MAINTENANT)
    expect(r).toBeNull()
  })

  it.each([
    ["envisage", true],
    ["inscrit", true],
    ["paye", true],
    ["forfait", false],
    ["abandon", false],
    ["arrivee", false],
    ["parti", false],
  ] as const)("statut %s : bloquant %s", (statut, attendu) => {
    const r = rangObligation({ valableJusquAu: jour("2027-03-14") }, [engagement({ debut: "2027-03-15", statut })], MAINTENANT)
    expect(r !== null).toBe(attendu)
  })

  it("deux épreuves proches : la plus tôt est nommée", () => {
    const r = rangObligation(
      { valableJusquAu: jour("2027-03-11") },
      [engagement({ eventId: "tard", debut: "2027-03-16" }), engagement({ eventId: "tot", debut: "2027-03-12" })],
      MAINTENANT,
    )
    expect(r).toEqual({ priorite: PRIORITE.bloquant, eventId: "tot" })
  })

  it("une épreuve hors fenêtre et une dans la fenêtre : celle de la fenêtre", () => {
    const r = rangObligation(
      { valableJusquAu: jour("2027-03-11") },
      [engagement({ eventId: "loin", debut: "2027-04-20" }), engagement({ eventId: "proche", debut: "2027-03-13" })],
      MAINTENANT,
    )
    expect(r?.eventId).toBe("proche")
  })
})

describe("engagementAPayer (Saison, payer_engagement)", () => {
  it("envisagé ou inscrit dans la fenêtre : à payer", () => {
    expect(engagementAPayer([engagement({ debut: "2027-03-15", statut: "envisage" })], MAINTENANT)?.statut).toBe("envisage")
    expect(engagementAPayer([engagement({ debut: "2027-03-15", statut: "inscrit" })], MAINTENANT)?.statut).toBe("inscrit")
  })

  it("payé : rien à payer", () => {
    expect(engagementAPayer([engagement({ debut: "2027-03-15", statut: "paye" })], MAINTENANT)).toBeNull()
  })

  it("hors fenêtre, forfait ou annulée : rien à payer", () => {
    expect(engagementAPayer([engagement({ debut: "2027-03-18", statut: "inscrit" })], MAINTENANT)).toBeNull()
    expect(engagementAPayer([engagement({ debut: "2027-03-15", statut: "forfait" })], MAINTENANT)).toBeNull()
    expect(engagementAPayer([engagement({ debut: "2027-03-15", statut: "inscrit", annulee: true })], MAINTENANT)).toBeNull()
  })

  it("deux épreuves à payer : la plus tôt", () => {
    const r = engagementAPayer(
      [engagement({ eventId: "tard", debut: "2027-03-16" }), engagement({ eventId: "tot", debut: "2027-03-12" })],
      MAINTENANT,
    )
    expect(r?.eventId).toBe("tot")
  })
})
