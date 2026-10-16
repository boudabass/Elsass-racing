import { describe, expect, it } from "vitest"

import { libelleCompteARebours } from "./prochaine-etape"

const JOUR = 24 * 60 * 60 * 1000

describe("libelle de compte à rebours", () => {
  const maintenant = new Date("2026-10-16T10:00:00Z")

  it("donne J-n à plus de deux jours", () => {
    const epreuve = { nom: "Super Slalom", dateDebut: new Date(Date.UTC(2026, 10, 11)) }
    expect(libelleCompteARebours(epreuve, maintenant)).toBe("J-26")
  })

  it("donne Demain la veille", () => {
    const epreuve = { nom: "Rallye", dateDebut: new Date(maintenant.getTime() + JOUR) }
    expect(libelleCompteARebours(epreuve, maintenant)).toBe("Demain")
  })

  it("donne Aujourd'hui le jour même", () => {
    const epreuve = { nom: "Rallye", dateDebut: new Date("2026-10-16T00:00:00Z") }
    expect(libelleCompteARebours(epreuve, maintenant)).toBe("Aujourd'hui")
  })
})
