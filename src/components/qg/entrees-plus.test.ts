import { describe, expect, it } from "vitest"

import { entreesDuMenuPlus } from "./entrees-plus"

describe("menu « + » selon le rôle", () => {
  it("n'offre rien à un invité", () => {
    expect(entreesDuMenuPlus("invite", false)).toEqual([])
  })

  it("offre Dépense, Réglage, Photo et Note à l'assistance, sans Épreuve ni Véhicule", () => {
    expect(entreesDuMenuPlus("assistance", false).map((e) => e.libelle)).toEqual(["Dépense", "Réglage", "Photo", "Note"])
  })

  it("offre tout au responsable : Épreuve, Véhicule, Dépense, Réglage actives ; Photo désactivée avec sa raison ; Note active", () => {
    const entrees = entreesDuMenuPlus("responsable", false)
    expect(entrees.map((e) => e.libelle)).toEqual(["Épreuve", "Véhicule", "Partenaire", "Dépense", "Réglage", "Photo", "Note"])
    expect(entrees.find((e) => e.libelle === "Partenaire")).toEqual({ libelle: "Partenaire", desactivee: false, href: "/apps/partenaires/nouveau" })
    expect(entrees.filter((e) => e.desactivee).every((e) => e.raison)).toBe(true)
    expect(entrees.find((e) => e.libelle === "Dépense")).toEqual({ libelle: "Dépense", desactivee: false, href: "/apps/budget/nouvelle" })
    expect(entrees.find((e) => e.libelle === "Note")).toEqual({ libelle: "Note", desactivee: false, href: "/notes?nouvelle=1" })
    expect(entrees.find((e) => e.libelle === "Épreuve")).toEqual({ libelle: "Épreuve", desactivee: false, href: "/apps/saison/nouvelle" })
    expect(entrees.find((e) => e.libelle === "Réglage")).toEqual({ libelle: "Réglage", desactivee: false, href: "/apps/voiture/reglage-rapide" })
    expect(entrees.find((e) => e.libelle === "Véhicule")).toEqual({ libelle: "Véhicule", desactivee: false, href: "/apps/voiture/nouveau" })
  })

  it("ouvre Épreuve, Véhicule et Réglage à l'équipage, comme au responsable", () => {
    const libelles = entreesDuMenuPlus("equipage", false).map((e) => e.libelle)
    expect(libelles).toContain("Épreuve")
    expect(libelles).toContain("Véhicule")
    expect(libelles).toContain("Réglage")
  })

  it("réduit aux entrées de terrain en mode terrain : Réglage reste, Épreuve et Véhicule partent", () => {
    expect(entreesDuMenuPlus("responsable", true).map((e) => e.libelle)).toEqual(["Dépense", "Réglage", "Photo", "Note"])
    expect(entreesDuMenuPlus("equipage", true).map((e) => e.libelle)).toEqual(["Dépense", "Réglage", "Photo", "Note"])
  })

  it("ouvre Réglage à l'assistance en mode terrain, sans Véhicule", () => {
    const entrees = entreesDuMenuPlus("assistance", true)
    expect(entrees.map((e) => e.libelle)).toEqual(["Dépense", "Réglage", "Photo", "Note"])
    expect(entrees.find((e) => e.libelle === "Véhicule")).toBeUndefined()
  })
})
