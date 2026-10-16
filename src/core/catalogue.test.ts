import { describe, expect, it } from "vitest"

import { APPS, DROITS_PAR_DEFAUT } from "./catalogue"

const ROLES = ["responsable", "equipage", "assistance", "invite"]

describe("catalogue des apps", () => {
  it("contient 11 apps", () => {
    expect(APPS).toHaveLength(11)
  })

  it("a des clés uniques", () => {
    const cles = APPS.map((app) => app.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it("toute app requise existe dans le catalogue", () => {
    const cles = new Set(APPS.map((app) => app.cle))
    for (const app of APPS) {
      for (const requise of app.requiert) {
        expect(cles.has(requise), `${app.cle} requiert ${requise}, absente du catalogue`).toBe(true)
      }
    }
  })

  it("aucune app ne se requiert elle-même", () => {
    for (const app of APPS) {
      expect(app.requiert).not.toContain(app.cle)
    }
  })
})

describe("droits par défaut", () => {
  it("contiennent 44 lignes (4 rôles × 11 apps)", () => {
    expect(DROITS_PAR_DEFAUT).toHaveLength(44)
  })

  it("donnent un couple (rôle, app) une seule fois, et tous les couples sont présents", () => {
    const couples = DROITS_PAR_DEFAUT.map((droit) => `${droit.role}/${droit.appCle}`)
    expect(new Set(couples).size).toBe(couples.length)

    for (const role of ROLES) {
      for (const app of APPS) {
        expect(couples).toContain(`${role}/${app.cle}`)
      }
    }
  })

  it("ne référencent que des apps du catalogue", () => {
    const cles = new Set(APPS.map((app) => app.cle))
    for (const droit of DROITS_PAR_DEFAUT) {
      expect(cles.has(droit.appCle)).toBe(true)
    }
  })
})
