import { describe, expect, it } from "vitest"

import { correspond, enregistrerGestionnaire, trouverGestionnaire } from "./gestionnaires"

describe("correspondance des gestionnaires", () => {
  it("un nom exact ne correspond qu'à lui-même", () => {
    expect(correspond("saison.saison_creee", "saison.saison_creee")).toBe(true)
    expect(correspond("saison.saison_creee", "saison.saison_cloturee")).toBe(false)
  })

  it("un motif *.action_requise correspond à toute app", () => {
    expect(correspond("*.action_requise", "saison.action_requise")).toBe(true)
    expect(correspond("*.action_requise", "garage.action_requise")).toBe(true)
  })

  it("un motif *.action_requise ne correspond pas à action_levee", () => {
    expect(correspond("*.action_requise", "saison.action_levee")).toBe(false)
  })

  it("trouve le gestionnaire enregistré pour une app et un nom", () => {
    const fn = async () => {}
    enregistrerGestionnaire("test-app", "test-app.evenement", fn)
    expect(trouverGestionnaire("test-app", "test-app.evenement")).toBe(fn)
    expect(trouverGestionnaire("test-app", "test-app.autre")).toBeUndefined()
    expect(trouverGestionnaire("autre-app", "test-app.evenement")).toBeUndefined()
  })
})
