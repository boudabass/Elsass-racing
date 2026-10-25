import { describe, expect, it } from "vitest"

import { LIBELLES_STATUT_PNEUS, MESSAGE_TRAIN_A_ACHETER, separerDateAchat, statutPneusValide, trainDeLaVoiture, trainValide, usureValide, validerSaisieTrain } from "./pneus"
import { prixImposeFournisseur } from "./regles"

describe("trainValide", () => {
  it("accepte un train avec une marque et un type connus", () => {
    expect(trainValide({ marque: "Michelin", type: "pluie" })).toBeNull()
  })

  it("refuse une marque vide ou faite d'espaces, avec sa raison", () => {
    expect(trainValide({ marque: "   ", type: "terre" })).toBe("Indique la marque du train.")
  })

  it("refuse un type hors liste, avec sa raison", () => {
    expect(trainValide({ marque: "Pirelli", type: "slick" })).toBe("Choisis le type du train : asphalte, terre, pluie ou neige.")
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

// Saisie d'un train, comme le service la reçoit : la date d'achat se sépare avant la validation du schéma strict.
describe("saisie complète d'un train, date d'achat comprise", () => {
  const saisieComplete = {
    marque: "  Michelin ",
    modele: "Alpin",
    gomme: "Pilote",
    type: "pluie",
    dimensions: "195/55 R15",
    acheteLe: "2026-10-20",
  }

  it("sépare la date d'achat, puis valide le train avec ses champs nettoyés", () => {
    const { saisie, acheteLe } = separerDateAchat(saisieComplete)
    expect(acheteLe).toBe("2026-10-20")
    expect(saisie).not.toHaveProperty("acheteLe")
    expect(validerSaisieTrain(saisie)).toEqual({
      train: { marque: "Michelin", modele: "Alpin", gomme: "Pilote", type: "pluie", dimensions: "195/55 R15" },
    })
  })

  it("une date d'achat laissée dans la saisie est refusée par le schéma strict", () => {
    expect(validerSaisieTrain(saisieComplete)).toEqual({ erreur: "Ce train n'est pas enregistrable : vérifie la saisie." })
  })

  it("sans date d'achat, la date est nulle et le train reste valide", () => {
    const { saisie, acheteLe } = separerDateAchat({ marque: "Continental", type: "terre" })
    expect(acheteLe).toBeNull()
    expect(validerSaisieTrain(saisie)).toEqual({ train: { marque: "Continental", modele: null, gomme: null, type: "terre", dimensions: null } })
  })

  it("une marque vide ou un type inconnu sont refusés avec leur raison", () => {
    expect(validerSaisieTrain({ marque: " ", type: "terre" })).toEqual({ erreur: "Indique la marque du train." })
    expect(validerSaisieTrain({ marque: "Pirelli", type: "slick" })).toEqual({
      erreur: "Choisis le type du train : asphalte, terre, pluie ou neige.",
    })
  })
})

// Saisie avec prix : le train est validé, et le prix ne passe que si un fournisseur est choisi.
describe("saisie d'un train avec prix", () => {
  it("valide le train, et refuse un prix sans fournisseur avec sa raison", () => {
    expect(validerSaisieTrain({ marque: "Michelin", type: "pluie" })).toEqual({
      train: { marque: "Michelin", modele: null, gomme: null, type: "pluie", dimensions: null },
    })
    expect(prixImposeFournisseur(12000, null)).toBe("Une pièce avec un prix demande son fournisseur.")
    expect(prixImposeFournisseur(12000, "fournisseur-1")).toBeNull()
  })
})
