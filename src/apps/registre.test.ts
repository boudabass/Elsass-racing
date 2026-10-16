import { describe, expect, it } from "vitest"

import { APPS } from "../core/catalogue"
import { validerManifeste } from "../core/sdk/manifeste"

import { manifeste, manifestes } from "./registre"

describe("registre des apps", () => {
  it("contient les manifestes importés, tous valides", () => {
    for (const m of manifestes()) {
      expect(validerManifeste(m), m.cle).toEqual([])
    }
  })

  it("n'a aucune clé en double", () => {
    const cles = manifestes().map((m) => m.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it("toute app requise est dans le registre ou dans le catalogue", () => {
    // Le registre peut être incomplet pendant le lot 1 : le catalogue fait foi.
    const connues = new Set(APPS.map((app) => app.cle))
    for (const m of manifestes()) {
      for (const requise of m.requiert) {
        expect(connues.has(requise), `${m.cle} requiert ${requise}`).toBe(true)
      }
    }
  })

  it("retrouve un manifeste par sa clé, et undefined sinon", () => {
    expect(manifeste("settings")?.nom).toBe("Réglages")
    expect(manifeste("budget")).toBeUndefined()
  })
})
