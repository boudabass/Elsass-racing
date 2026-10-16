import { describe, expect, it } from "vitest"

import { entreesDuMenuPlus } from "./entrees-plus"

describe("menu « + » selon le rôle", () => {
  it("n'offre rien à un invité", () => {
    expect(entreesDuMenuPlus("invite", false)).toEqual([])
  })

  it("offre Photo et Note à l'assistance, sans Épreuve", () => {
    expect(entreesDuMenuPlus("assistance", false).map((e) => e.libelle)).toEqual(["Dépense", "Photo", "Note"])
  })

  it("offre tout au responsable : Épreuve et Dépense actives, Photo désactivée avec sa raison, Note active", () => {
    const entrees = entreesDuMenuPlus("responsable", false)
    expect(entrees.map((e) => e.libelle)).toEqual(["Épreuve", "Dépense", "Photo", "Note"])
    expect(entrees.filter((e) => e.desactivee).every((e) => e.raison)).toBe(true)
    expect(entrees.find((e) => e.libelle === "Dépense")).toEqual({ libelle: "Dépense", desactivee: false, href: "/apps/budget/nouvelle" })
    expect(entrees.find((e) => e.libelle === "Note")).toEqual({ libelle: "Note", desactivee: false, href: "/notes?nouvelle=1" })
    expect(entrees.find((e) => e.libelle === "Épreuve")).toEqual({ libelle: "Épreuve", desactivee: false, href: "/apps/saison/nouvelle" })
  })

  it("ouvre Épreuve à l'équipage, comme au responsable", () => {
    expect(entreesDuMenuPlus("equipage", false).map((e) => e.libelle)).toContain("Épreuve")
  })

  it("réduit aux entrées de terrain en mode terrain, sans Épreuve", () => {
    expect(entreesDuMenuPlus("responsable", true).map((e) => e.libelle)).toEqual(["Dépense", "Photo", "Note"])
    expect(entreesDuMenuPlus("equipage", true).map((e) => e.libelle)).toEqual(["Dépense", "Photo", "Note"])
  })
})
