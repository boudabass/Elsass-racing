import { describe, expect, it } from "vitest"

import { ficheACompleter, LIBELLES_TYPE_CASSE, montageALaDate, typeCasseValide } from "./casses"

describe("typeCasseValide", () => {
  it("accepte les trois types de l'enum, et refuse le reste", () => {
    expect(typeCasseValide("casse_mecanique")).toBe(true)
    expect(typeCasseValide("sortie")).toBe(true)
    expect(typeCasseValide("accident")).toBe(true)
    expect(typeCasseValide("inconnue")).toBe(false)
    expect(typeCasseValide("")).toBe(false)
  })
})

describe("libellés des types de casse", () => {
  it("affichent le vocabulaire du rallye, sans renommer les valeurs", () => {
    expect(LIBELLES_TYPE_CASSE).toEqual({ casse_mecanique: "Casse mécanique", sortie: "Sortie de route", accident: "Accident" })
  })
})

describe("ficheACompleter", () => {
  it("reste à compléter sans type, même avec des organes touchés", () => {
    expect(ficheACompleter({ type: null, organesTouches: 2 })).toBe(true)
  })

  it("reste à compléter sans organe touché, même avec un type", () => {
    expect(ficheACompleter({ type: "accident", organesTouches: 0 })).toBe(true)
  })

  it("n'est plus à compléter une fois le type et un organe renseignés", () => {
    expect(ficheACompleter({ type: "sortie", organesTouches: 1 })).toBe(false)
  })
})

describe("montageALaDate", () => {
  const casse = new Date("2026-10-20T00:00:00Z")
  const avant = new Date("2026-10-19T00:00:00Z")
  const apres = new Date("2026-10-21T00:00:00Z")

  it("compte une pièce posée avant la casse et jamais déposée", () => {
    expect(montageALaDate({ poseLe: avant, deposeeLe: null }, casse)).toBe(true)
  })

  it("compte une pièce posée le jour même de la casse", () => {
    expect(montageALaDate({ poseLe: casse, deposeeLe: null }, casse)).toBe(true)
  })

  it("ne compte pas une pièce posée après la casse", () => {
    expect(montageALaDate({ poseLe: apres, deposeeLe: null }, casse)).toBe(false)
  })

  it("ne compte pas une pièce déposée avant la casse, et compte celle déposée le jour même", () => {
    expect(montageALaDate({ poseLe: avant, deposeeLe: avant }, casse)).toBe(false)
    expect(montageALaDate({ poseLe: avant, deposeeLe: casse }, casse)).toBe(true)
  })
})
