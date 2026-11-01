import { describe, expect, it } from "vitest"

import { cleLien, dansPortee } from "./objets-lies"
import type { ObjetLieLu, PorteeListe } from "./objets-types"

const VEHICULE = "11111111-1111-4111-8111-111111111111"
const AUTRE_VEHICULE = "22222222-2222-4222-8222-222222222222"
const PILOTE = "33333333-3333-4333-8333-333333333333"
const ETRANGER = "44444444-4444-4444-8444-444444444444"

function objet(partiel: Partial<ObjetLieLu> & Pick<ObjetLieLu, "type">): ObjetLieLu {
  return { id: "o1", libelle: "Objet", etat: "", alerte: false, vehicleId: null, personId: null, ...partiel }
}

const portee: PorteeListe = { vehicleId: VEHICULE, personIds: [PILOTE] }

describe("portée d'un objet lié (5.7a)", () => {
  it("un organe du véhicule de la liste est dans la portée", () => {
    expect(dansPortee(objet({ type: "organe_garage", vehicleId: VEHICULE }), portee)).toBe(true)
  })

  it("un organe d'un autre véhicule n'est pas dans la portée", () => {
    expect(dansPortee(objet({ type: "organe_garage", vehicleId: AUTRE_VEHICULE }), portee)).toBe(false)
  })

  it("une liste commune (sans véhicule) ne reçoit aucun objet de véhicule", () => {
    expect(dansPortee(objet({ type: "papier_voiture", vehicleId: VEHICULE }), { vehicleId: null, personIds: [] })).toBe(false)
  })

  it("une licence de la personne de l'engagement est dans la portée, celle d'une autre personne non", () => {
    expect(dansPortee(objet({ type: "licence_equipe", personId: PILOTE }), portee)).toBe(true)
    expect(dansPortee(objet({ type: "licence_equipe", personId: ETRANGER }), portee)).toBe(false)
  })

  it("une contrepartie et un document de la team se proposent sur toutes les listes, communes comprises", () => {
    expect(dansPortee(objet({ type: "contrepartie_partenaires" }), { vehicleId: null, personIds: [] })).toBe(true)
    expect(dansPortee(objet({ type: "document_documents" }), { vehicleId: null, personIds: [] })).toBe(true)
  })
})

describe("clé d'un objet lié (5.7a)", () => {
  it("combine le type et l'identifiant, pour distinguer deux objets de même id dans deux apps", () => {
    expect(cleLien("organe_garage", "a")).toBe("organe_garage:a")
    expect(cleLien("organe_garage", "a")).not.toBe(cleLien("papier_voiture", "a"))
  })
})
