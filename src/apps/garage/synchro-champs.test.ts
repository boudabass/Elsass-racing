import { describe, expect, it } from "vitest"

import { fautEmettreTravailTermine, schemaChampsOrdreHorsLigne, schemaCreationIntervention, schemaModificationOrdre } from "./synchro-champs"

const VEHICULE = "0190a7c2-0000-7000-8000-000000000001"
const ORGANE = "0190a7c2-0000-7000-8000-000000000002"

// Hors ligne, un ordre ne s'écrit qu'en intervention rapide (création) ou en statut et avancement (modification) : tout le reste
// (coût, prestataire, pièce, affectation) reste en ligne (D5, D2).
describe("écritures hors ligne d'un ordre de travail", () => {
  it("crée une intervention avec le véhicule, l'organe et le titre", () => {
    expect(schemaCreationIntervention.safeParse({ vehicleId: VEHICULE, vehicleComponentId: ORGANE, titre: "Plaquettes" }).success).toBe(true)
  })

  it("refuse une intervention sans titre, et tout champ de prix, de pièce ou de statut en plus", () => {
    expect(schemaCreationIntervention.safeParse({ vehicleId: VEHICULE, vehicleComponentId: ORGANE, titre: "  " }).success).toBe(false)
    for (const champ of [{ coutMainOeuvreCents: 1000 }, { prestataireContactId: VEHICULE }, { partId: ORGANE }, { statut: "termine" }]) {
      expect(schemaCreationIntervention.safeParse({ vehicleId: VEHICULE, vehicleComponentId: ORGANE, titre: "Plaquettes", ...champ }).success).toBe(false)
    }
  })

  it("modifie le statut et l'avancement, seuls", () => {
    expect(schemaModificationOrdre.safeParse({ statut: "en_cours" }).success).toBe(true)
    expect(schemaModificationOrdre.safeParse({ statut: "termine" }).success).toBe(true)
    expect(schemaModificationOrdre.safeParse({ avancementPct: 40 }).success).toBe(true)
    expect(schemaModificationOrdre.safeParse({ avancementPct: 101 }).success).toBe(false)
    expect(schemaModificationOrdre.safeParse({ statut: "annule" }).success).toBe(false)
  })

  it("refuse une modification vide, un titre ou un coût", () => {
    expect(schemaModificationOrdre.safeParse({}).success).toBe(false)
    expect(schemaModificationOrdre.safeParse({ titre: "Autre titre" }).success).toBe(false)
    expect(schemaModificationOrdre.safeParse({ coutMainOeuvreCents: 5000 }).success).toBe(false)
  })

  it("émet garage.travail_termine seulement pour un ordre terminé et non supprimé, absent ou non", () => {
    expect(fautEmettreTravailTermine({ statut: "termine", deletedAt: null })).toBe(true)
    expect(fautEmettreTravailTermine({ statut: "en_cours", deletedAt: null })).toBe(false)
    expect(fautEmettreTravailTermine({ statut: "termine", deletedAt: new Date() })).toBe(false)
    expect(fautEmettreTravailTermine(null)).toBe(false)
  })

  it("accepte une création ou une modification, jamais un mélange des deux", () => {
    expect(schemaChampsOrdreHorsLigne.safeParse({ statut: "termine", avancementPct: 100 }).success).toBe(true)
    expect(schemaChampsOrdreHorsLigne.safeParse({ vehicleId: VEHICULE, vehicleComponentId: ORGANE, titre: "Plaquettes" }).success).toBe(true)
    expect(schemaChampsOrdreHorsLigne.safeParse({ vehicleId: VEHICULE, vehicleComponentId: ORGANE, titre: "Plaquettes", statut: "termine" }).success).toBe(false)
  })
})
