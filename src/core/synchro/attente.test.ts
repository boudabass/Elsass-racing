import { describe, expect, it } from "vitest"

import { delaiAvantNouvelEssai } from "./attente"

describe("attente entre deux tentatives", () => {
  it("croît à chaque échec", () => {
    expect(delaiAvantNouvelEssai(1)).toBe(2000)
    expect(delaiAvantNouvelEssai(2)).toBe(4000)
    expect(delaiAvantNouvelEssai(3)).toBe(8000)
  })

  it("ne dépasse jamais une minute", () => {
    expect(delaiAvantNouvelEssai(6)).toBe(60_000)
    expect(delaiAvantNouvelEssai(50)).toBe(60_000)
  })

  it("ne descend pas sous la première attente", () => {
    expect(delaiAvantNouvelEssai(0)).toBe(2000)
  })
})
