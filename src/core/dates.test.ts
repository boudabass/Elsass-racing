import { describe, expect, it } from "vitest"

import { jourDeParis, jourEnFrancais } from "./dates"

describe("jourEnFrancais", () => {
  it("écrit le jour en toutes lettres, en français", () => {
    expect(jourEnFrancais(new Date("2026-10-17T10:00:00Z"))).toBe("17 octobre 2026")
  })

  it("lit le jour à Paris : 23 h 30 UTC le 16 octobre, c'est déjà le 17 à Paris", () => {
    const instant = new Date("2026-10-16T23:30:00Z")
    expect(jourDeParis(instant)).toBe("2026-10-17")
    expect(jourEnFrancais(instant)).toBe("17 octobre 2026")
  })
})
