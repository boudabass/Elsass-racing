import { describe, expect, it } from "vitest"

import { champDateHeure, positionCreneau } from "./reconnaissances"
import { instantParis } from "./regles"

describe("positionCreneau", () => {
  const debut = new Date("2026-10-10T08:00:00Z")
  const fin = new Date("2026-10-11T18:00:00Z")

  it("dans le créneau, bornes comprises (jours de Paris)", () => {
    expect(positionCreneau(debut, fin, "2026-10-10")).toBe("dans")
    expect(positionCreneau(debut, fin, "2026-10-11")).toBe("dans")
  })

  it("hors créneau avant et après", () => {
    expect(positionCreneau(debut, fin, "2026-10-09")).toBe("hors")
    expect(positionCreneau(debut, fin, "2026-10-12")).toBe("hors")
  })

  it("sans fin, le créneau tient dans le seul jour de début", () => {
    expect(positionCreneau(debut, null, "2026-10-10")).toBe("dans")
    expect(positionCreneau(debut, null, "2026-10-11")).toBe("hors")
  })

  it("sans début défini, la position n'est pas connue", () => {
    expect(positionCreneau(null, null, "2026-10-10")).toBe("non_defini")
  })
})

describe("champDateHeure", () => {
  it("donne l'heure de Paris, au format d'un champ datetime-local", () => {
    expect(champDateHeure(new Date("2026-10-10T08:00:00Z"))).toBe("2026-10-10T10:00")
    expect(champDateHeure(null)).toBe("")
  })

  it("aller-retour avec instantParis", () => {
    const valeur = champDateHeure(new Date("2026-10-26T09:30:00Z"))
    expect(instantParis(valeur)?.toISOString()).toBe("2026-10-26T09:30:00.000Z")
  })
})
