import { describe, expect, it } from "vitest"

import { entreesDuMenuPlus } from "./entrees-plus"

describe("menu « + » selon le rôle", () => {
  it("n'offre rien à un invité", () => {
    expect(entreesDuMenuPlus("invite", false)).toEqual([])
  })

  it("offre Photo et Note à l'assistance", () => {
    expect(entreesDuMenuPlus("assistance", false).map((e) => e.libelle)).toEqual(["Photo", "Note"])
  })

  it("offre tout au responsable : Dépense et Photo désactivées avec leur raison, Note active", () => {
    const entrees = entreesDuMenuPlus("responsable", false)
    expect(entrees.map((e) => e.libelle)).toEqual(["Dépense", "Photo", "Note"])
    expect(entrees.filter((e) => e.desactivee).every((e) => e.raison)).toBe(true)
    expect(entrees.find((e) => e.libelle === "Note")).toEqual({ libelle: "Note", desactivee: false, href: "/notes?nouvelle=1" })
  })

  it("réduit aux entrées de terrain en mode terrain", () => {
    expect(entreesDuMenuPlus("responsable", true).map((e) => e.libelle)).toEqual(["Photo", "Note"])
  })
})
