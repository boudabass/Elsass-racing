import { describe, expect, it } from "vitest"

import { objetDocument } from "./objets-checklist"

const maintenant = new Date("2026-10-20T12:00:00Z")

describe("document de Documents lu par Check-lists (5.7a)", () => {
  it("un document expiré : alerte, date dans le texte", () => {
    const objet = objetDocument({ id: "d1", title: "Attestation d'assurance", validUntil: new Date("2026-10-10T00:00:00Z") }, maintenant)
    expect(objet).toEqual({
      type: "document_documents",
      id: "d1",
      libelle: "Attestation d'assurance",
      etat: "Expiré le 10 octobre 2026",
      alerte: true,
      vehicleId: null,
      personId: null,
    })
  })

  it("un document à renouveler dans la fenêtre d'alerte de Documents : alerte", () => {
    const objet = objetDocument({ id: "d2", title: "Assurance", validUntil: new Date("2026-11-05T00:00:00Z") }, maintenant)
    expect(objet.alerte).toBe(true)
    expect(objet.etat).toContain("À renouveler")
  })

  it("un document sans date de validité : pas d'alerte", () => {
    const objet = objetDocument({ id: "d3", title: "Règlement", validUntil: null }, maintenant)
    expect(objet).toMatchObject({ etat: "Sans date de fin", alerte: false })
  })
})
