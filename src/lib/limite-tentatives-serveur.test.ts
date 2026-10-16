import { describe, expect, it } from "vitest"

import { LimiteTentatives } from "./limite-tentatives-serveur"

const MINUTE = 60_000

describe("LimiteTentatives", () => {
  it("accepte jusqu'au maximum, puis refuse dans la fenêtre", () => {
    const limite = new LimiteTentatives(5, 15 * MINUTE)
    const t0 = 0
    for (let i = 0; i < 5; i++) expect(limite.tenter("cle", t0)).toBe(true)
    expect(limite.tenter("cle", t0)).toBe(false)
    expect(limite.tenter("cle", t0 + 14 * MINUTE)).toBe(false)
  })

  it("repart à zéro à la fin de la fenêtre", () => {
    const limite = new LimiteTentatives(5, 15 * MINUTE)
    for (let i = 0; i < 5; i++) limite.tenter("cle", 0)
    expect(limite.tenter("cle", 15 * MINUTE)).toBe(true)
  })

  it("ne refuse pas une clé différente", () => {
    const limite = new LimiteTentatives(2, MINUTE)
    limite.tenter("a", 0)
    limite.tenter("a", 0)
    expect(limite.tenter("a", 0)).toBe(false)
    expect(limite.tenter("b", 0)).toBe(true)
  })

  it("ne compte pas une tentative refusée", () => {
    const limite = new LimiteTentatives(1, MINUTE)
    expect(limite.tenter("cle", 0)).toBe(true)
    expect(limite.tenter("cle", 0)).toBe(false)
    expect(limite.estBloquee("cle", 0)).toBe(true)
  })

  it("compte les échecs sans consommer de tentative autorisée", () => {
    const limite = new LimiteTentatives(3, 10 * MINUTE)
    limite.echec("email", 0)
    limite.echec("email", 0)
    expect(limite.estBloquee("email", 0)).toBe(false)
    limite.echec("email", 0)
    expect(limite.estBloquee("email", 0)).toBe(true)
    expect(limite.estBloquee("email", 10 * MINUTE)).toBe(false)
  })

  it("se remet à zéro sur demande", () => {
    const limite = new LimiteTentatives(2, 10 * MINUTE)
    limite.echec("email", 0)
    limite.echec("email", 0)
    expect(limite.estBloquee("email", 0)).toBe(true)
    limite.reinitialiser("email")
    expect(limite.estBloquee("email", 0)).toBe(false)
  })
})
