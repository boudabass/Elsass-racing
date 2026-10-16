import { describe, expect, it } from "vitest"

import { APPS } from "../core/catalogue"
import { EVENEMENTS } from "../core/evenements/catalogue"
import { validerManifeste } from "../core/sdk/manifeste"

import { manifeste, manifestes } from "./registre"

describe("registre des apps", () => {
  it("contient les 11 manifestes, dans l'ordre du catalogue", () => {
    expect(manifestes()).toHaveLength(11)
    expect(manifestes().map((m) => m.cle)).toEqual(APPS.map((app) => app.cle))
  })

  it("tous les manifestes sont valides", () => {
    for (const m of manifestes()) {
      expect(validerManifeste(m), m.cle).toEqual([])
    }
  })

  it("n'a aucune clé en double", () => {
    const cles = manifestes().map((m) => m.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it("chaque manifeste émet exactement les événements du catalogue de son app", () => {
    for (const m of manifestes()) {
      const attendus = EVENEMENTS.filter((e) => e.emisPar === m.cle).map((e) => e.nom)
      expect([...m.evenementsEmis].sort(), m.cle).toEqual([...attendus].sort())
    }
  })

  it("toute app requise est dans le catalogue", () => {
    const connues = new Set(APPS.map((app) => app.cle))
    for (const m of manifestes()) {
      for (const requise of m.requiert) {
        expect(connues.has(requise), `${m.cle} requiert ${requise}`).toBe(true)
      }
    }
  })

  it("retrouve un manifeste par sa clé, et undefined sinon", () => {
    expect(manifeste("settings")?.nom).toBe("Réglages")
    expect(manifeste("saison")?.nom).toBe("Saison")
  })
})
