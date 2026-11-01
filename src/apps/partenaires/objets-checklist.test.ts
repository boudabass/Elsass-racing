import { describe, expect, it } from "vitest"

import { objetContrepartie } from "./objets-checklist"

const base = { id: "c1", libelle: "Logo sur la portière", slotNom: "Portière gauche", quantitePromise: 1, quantiteTenue: 0 }

describe("objet de Partenaires lu par Check-lists (5.7a)", () => {
  it("une contrepartie dont l'échéance est passée et non tenue : en retard, alerte", () => {
    const objet = objetContrepartie({ ...base, statut: "a_faire", echeance: new Date("2026-10-01T00:00:00Z") }, "2026-10-20")
    expect(objet).toMatchObject({ type: "contrepartie_partenaires", libelle: "Logo sur la portière · Portière gauche", etat: "En retard", alerte: true })
  })

  it("une contrepartie reportée n'est jamais en retard, même échue", () => {
    const objet = objetContrepartie({ ...base, statut: "reportee", echeance: new Date("2026-10-01T00:00:00Z") }, "2026-10-20")
    expect(objet).toMatchObject({ etat: "Reportée", alerte: false })
  })

  it("une contrepartie tenue : état Tenue, sans alerte, sans échéance", () => {
    const objet = objetContrepartie({ ...base, statut: "tenue", quantiteTenue: 1, echeance: null, slotNom: null }, "2026-10-20")
    expect(objet).toMatchObject({ libelle: "Logo sur la portière", etat: "Tenue", alerte: false })
  })
})
