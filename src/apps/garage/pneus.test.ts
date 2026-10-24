import { describe, expect, it } from "vitest"

import { LIBELLES_STATUT_PNEUS, MESSAGE_TRAIN_A_ACHETER, statutPneusValide, trainDeLaVoiture, trainValide, usureValide } from "./pneus"

describe("trainValide", () => {
  it("accepte un train avec une marque et un type connus", () => {
    expect(trainValide({ marque: "Michelin", type: "pluie" })).toBeNull()
  })

  it("refuse une marque vide ou faite d'espaces, avec sa raison", () => {
    expect(trainValide({ marque: "   ", type: "terre" })).toBe("Indiquez la marque du train.")
  })

  it("refuse un type hors liste, avec sa raison", () => {
    expect(trainValide({ marque: "Pirelli", type: "slick" })).toBe("Choisissez le type du train : asphalte, terre, pluie ou neige.")
  })
})

describe("usureValide", () => {
  it("accepte les bornes 0 et 100, et les valeurs entières entre les deux", () => {
    expect(usureValide(0)).toBeNull()
    expect(usureValide(100)).toBeNull()
    expect(usureValide(42)).toBeNull()
  })

  it("refuse hors de 0 à 100 et les décimales, avec sa raison", () => {
    const message = "L'usure estimée est un nombre entier de 0 à 100 %."
    expect(usureValide(-1)).toBe(message)
    expect(usureValide(101)).toBe(message)
    expect(usureValide(42.5)).toBe(message)
  })
})

describe("libellés des statuts de pneus", () => {
  it("affiche Neuf, Utilisé et Usé, sans renommer les valeurs", () => {
    expect(LIBELLES_STATUT_PNEUS).toEqual({ neuf: "Neuf", utilise: "Utilisé", use: "Usé" })
    expect(statutPneusValide("utilise")).toBe(true)
    expect(statutPneusValide("usee")).toBe(false)
  })
})

describe("trainDeLaVoiture", () => {
  it("refuse un train d'une autre voiture, avec sa raison", () => {
    expect(trainDeLaVoiture("voiture-a", "voiture-b")).toBe("Ce train appartient à une autre voiture.")
    expect(trainDeLaVoiture("voiture-a", "voiture-a")).toBeNull()
  })
})

describe("message d'achat d'un train", () => {
  it("renvoie vers l'écran Pneus, sans jargon", () => {
    expect(MESSAGE_TRAIN_A_ACHETER).toBe("Un train de pneus s'achète depuis l'écran Pneus.")
  })
})
