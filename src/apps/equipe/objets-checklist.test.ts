import { describe, expect, it } from "vitest"

import { objetEquipement, objetLicence } from "./objets-checklist"

const maintenant = new Date("2026-10-20T12:00:00Z")

describe("objets d'Équipe lus par Check-lists (5.7a)", () => {
  it("une licence expirée : alerte, libellé du type, personne rattachée", () => {
    const objet = objetLicence({ id: "l1", personId: "p1", type: "ffsa_nationale", valableAu: new Date("2026-10-01T00:00:00Z") }, maintenant)
    expect(objet).toEqual({
      type: "licence_equipe",
      id: "l1",
      libelle: "Licence FFSA nationale",
      etat: "Expiré le 1 octobre 2026",
      alerte: true,
      vehicleId: null,
      personId: "p1",
    })
  })

  it("une licence valable au-delà de la fenêtre : pas d'alerte", () => {
    const objet = objetLicence({ id: "l2", personId: "p1", type: "autre", valableAu: new Date("2027-06-30T00:00:00Z") }, maintenant)
    expect(objet).toMatchObject({ libelle: "Licence", alerte: false })
  })

  it("un équipement sans fin d'homologation : pas d'alerte, libellé de l'équipement", () => {
    const objet = objetEquipement({ id: "e1", personId: "p2", type: "hans", finHomologation: null }, maintenant)
    expect(objet).toMatchObject({ type: "homologation_equipe", libelle: "HANS", etat: "Sans date de fin", alerte: false, personId: "p2" })
  })
})
