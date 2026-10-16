import { describe, expect, it } from "vitest"

import { montantSaisi } from "./saisie"

describe("montant saisi en euros", () => {
  it("lit la virgule et le point, avec ou sans espaces de milliers", () => {
    expect(montantSaisi("12,50")).toBe(1250)
    expect(montantSaisi("12.5")).toBe(1250)
    expect(montantSaisi("1 234,5")).toBe(123450)
    expect(montantSaisi("1 234,05")).toBe(123405)
    expect(montantSaisi("0")).toBe(0)
  })

  it("refuse ce qui n'est pas un montant positif ou nul", () => {
    expect(montantSaisi("")).toBeNull()
    expect(montantSaisi("abc")).toBeNull()
    expect(montantSaisi("-5")).toBeNull()
    expect(montantSaisi("1,234")).toBeNull()
  })
})
