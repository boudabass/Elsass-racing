import { describe, expect, it } from "vitest"

import { objetOrgane, objetTrain } from "./objets-checklist"

describe("objets de Garage lus par Check-lists (5.7a)", () => {
  it("un organe en zone rouge avec sa pièce : état écrit, alerte", () => {
    const objet = objetOrgane({ id: "o1", nom: "Amortisseur", position: null, zone: "rouge", pieceMontee: true }, "v1")
    expect(objet).toEqual({ type: "organe_garage", id: "o1", libelle: "Amortisseur", etat: "Zone rouge", alerte: true, vehicleId: "v1", personId: null })
  })

  it("un organe sans pièce montée : pas d'alerte, même si la zone est mauvaise", () => {
    const objet = objetOrgane({ id: "o2", nom: "Disque", position: null, zone: "rouge", pieceMontee: false }, "v1")
    expect(objet.etat).toBe("Aucune pièce montée")
    expect(objet.alerte).toBe(false)
  })

  it("un train de pneus : marque et modèle, épreuves au singulier puis au pluriel, jamais d'alerte", () => {
    const un = objetTrain({ id: "t1", marque: "Michelin", modele: "Pilot", nombreEpreuves: 1 }, "v1")
    expect(un).toMatchObject({ type: "train_pneus", libelle: "Michelin Pilot", etat: "1 épreuve", alerte: false })
    const trois = objetTrain({ id: "t2", marque: "Pirelli", modele: null, nombreEpreuves: 3 }, "v1")
    expect(trois).toMatchObject({ libelle: "Pirelli", etat: "3 épreuves" })
  })
})
