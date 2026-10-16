import { describe, expect, it } from "vitest"

import { peutChangerAcces, type MembreRegle } from "./regles"

const responsable: MembreRegle = { id: "r1", role: "responsable", statut: "actif" }
const equipier: MembreRegle = { id: "e1", role: "equipage", statut: "actif" }
const autreResponsable: MembreRegle = { id: "r2", role: "responsable", statut: "actif" }

describe("règle du dernier responsable", () => {
  it("refuse de retirer le seul responsable actif", () => {
    const verdict = peutChangerAcces([responsable, equipier], "r1", { role: "responsable", statut: "parti" })
    expect(verdict).toEqual({ ok: false, raison: "Nomme d'abord un autre responsable." })
  })

  it("refuse de rétrograder le seul responsable actif", () => {
    const verdict = peutChangerAcces([responsable, equipier], "r1", { role: "equipage", statut: "actif" })
    expect(verdict.ok).toBe(false)
  })

  it("autorise le retrait d'un responsable quand un autre reste actif", () => {
    const verdict = peutChangerAcces([responsable, autreResponsable], "r1", { role: "responsable", statut: "parti" })
    expect(verdict).toEqual({ ok: true })
  })

  it("autorise de changer un équipier, même sans responsable de plus", () => {
    const verdict = peutChangerAcces([responsable, equipier], "e1", { role: "invite", statut: "parti" })
    expect(verdict).toEqual({ ok: true })
  })

  it("ne compte pas un responsable parti comme un responsable actif", () => {
    const parti: MembreRegle = { id: "r2", role: "responsable", statut: "parti" }
    const verdict = peutChangerAcces([responsable, parti], "r1", { role: "equipage", statut: "actif" })
    expect(verdict.ok).toBe(false)
  })

  it("refuse un membre inconnu", () => {
    expect(peutChangerAcces([responsable], "inconnu", { role: "invite", statut: "parti" }).ok).toBe(false)
  })
})
