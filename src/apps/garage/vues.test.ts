import { describe, expect, it } from "vitest"

import { Prisma } from "@/generated/prisma/client"

import { versPiece } from "./vues"

// Un objet de pièce tel que Prisma le renvoie : le kilométrage est un vrai Decimal.
const piece = {
  id: "piece-1",
  designation: "Disque avant",
  marque: "Brembo",
  reference: "09.1234",
  statut: "montee" as const,
  kmCumules: new Prisma.Decimal("12.3"),
  epreuvesCumulees: 3,
  prixCents: 8900,
}

describe("versPiece : le prix ne sort qu'au niveau écriture ou plus (point 1 du brief)", () => {
  it("sans droit d'écriture (assistance, contribution) : aucune clé de prix dans l'objet", () => {
    const vue = versPiece(piece, false)
    expect(vue).not.toHaveProperty("prixCents")
    expect(JSON.stringify(vue)).not.toContain("8900")
  })

  it("avec un droit d'écriture : le prix est renvoyé", () => {
    expect(versPiece(piece, true).prixCents).toBe(8900)
  })

  it("convertit le kilométrage décimal en nombre dans les deux cas", () => {
    expect(versPiece(piece, false).kmCumules).toBe(12.3)
    expect(versPiece(piece, true).kmCumules).toBe(12.3)
  })
})
