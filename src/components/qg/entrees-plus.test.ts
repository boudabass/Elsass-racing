import { describe, expect, it } from "vitest"

import { entreesDuMenuPlus } from "./entrees-plus"

describe("menu « + » selon le rôle", () => {
  it("n'offre rien à un invité", () => {
    expect(entreesDuMenuPlus("invite", false)).toEqual([])
  })

  it("offre Photo et Note à l'assistance", () => {
    expect(entreesDuMenuPlus("assistance", false).map((e) => e.libelle)).toEqual(["Photo", "Note"])
  })

  it("offre tout au responsable, chaque entrée désactivée avec sa raison", () => {
    const entrees = entreesDuMenuPlus("responsable", false)
    expect(entrees.map((e) => e.libelle)).toEqual(["Dépense", "Photo", "Note"])
    expect(entrees.every((e) => e.desactivee && e.raison)).toBe(true)
  })

  it("réduit aux entrées de terrain en mode terrain", () => {
    expect(entreesDuMenuPlus("responsable", true).map((e) => e.libelle)).toEqual(["Photo", "Note"])
  })
})
