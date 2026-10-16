import { describe, expect, it } from "vitest"

import { newId } from "./ids"

// UUID v7 : version 7 en 13e caractère du 3e groupe, variante RFC 4122 en tête du 4e.
const FORMAT_UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("newId", () => {
  it("retourne un UUID v7 bien formé", () => {
    expect(newId()).toMatch(FORMAT_UUID_V7)
  })

  it("ne produit aucun doublon sur 1000 tirages", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) ids.add(newId())
    expect(ids.size).toBe(1000)
  })

  it("produit des ids croissants lexicographiquement quand ils sont générés à la suite", () => {
    let precedent = newId()
    for (let i = 0; i < 1000; i++) {
      const suivant = newId()
      expect(suivant > precedent).toBe(true)
      precedent = suivant
    }
  })
})
