import { describe, expect, it } from "vitest"

import { libelleTacheProbleme, pointTraiteParGarage } from "./regles"

describe("titre d'une tâche de problème (5.7a)", () => {
  it("nomme le point et sa liste", () => {
    expect(libelleTacheProbleme("Contrôle moteur", "Avant départ")).toBe("Problème : Contrôle moteur (Avant départ)")
  })

  it("sans liste : le point seul", () => {
    expect(libelleTacheProbleme("Pneus", null)).toBe("Problème : Pneus")
  })

  it("sans libellé (événement d'avant 5.7a) : un titre générique", () => {
    expect(libelleTacheProbleme(null, null)).toBe("Problème signalé")
  })
})

describe("point traité par Garage (5.7a)", () => {
  it("un point lié à un organe avec son identifiant est pour Garage", () => {
    expect(pointTraiteParGarage("organe_garage", "a")).toBe(true)
  })

  it("un point lié à un organe sans identifiant, ou à un autre objet, reste une tâche du socle", () => {
    expect(pointTraiteParGarage("organe_garage", null)).toBe(false)
    expect(pointTraiteParGarage("papier_voiture", "a")).toBe(false)
    expect(pointTraiteParGarage("aucun", null)).toBe(false)
    expect(pointTraiteParGarage(null, null)).toBe(false)
  })
})
