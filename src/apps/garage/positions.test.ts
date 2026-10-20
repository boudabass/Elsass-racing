import { describe, expect, it } from "vitest"

import { pointPourOrgane, pointValide } from "./positions"
import { TYPES_DEFAUT } from "./types-defaut"

// viewBox de la vue droite de la Saxo : « 0 -14 370 173 ». Les gabarits partagent ce dessin.
const LARGEUR_MIN = 0
const LARGEUR_MAX = 370
const HAUTEUR_MIN = -14
const HAUTEUR_MAX = 159

describe("positions par défaut", () => {
  it("chaque organe par défaut a un point sur la Saxo et sur le générique", () => {
    for (const type of TYPES_DEFAUT) {
      expect(pointPourOrgane("citadine_3p_saxo", { cle: type.cle, positions: null })).not.toBeNull()
      expect(pointPourOrgane("voiture_generique", { cle: type.cle, positions: null })).not.toBeNull()
    }
  })

  it("chaque point par défaut reste dans la viewBox", () => {
    for (const type of TYPES_DEFAUT) {
      const point = pointPourOrgane("citadine_3p_saxo", { cle: type.cle, positions: null })
      expect(point).not.toBeNull()
      expect(point!.x).toBeGreaterThanOrEqual(LARGEUR_MIN)
      expect(point!.x).toBeLessThanOrEqual(LARGEUR_MAX)
      expect(point!.y).toBeGreaterThanOrEqual(HAUTEUR_MIN)
      expect(point!.y).toBeLessThanOrEqual(HAUTEUR_MAX)
    }
  })

  it("un gabarit inconnu ou absent n'a aucune position", () => {
    expect(pointPourOrgane(null, { cle: "moteur", positions: null })).toBeNull()
    expect(pointPourOrgane("autre_gabarit", { cle: "moteur", positions: null })).toBeNull()
  })

  it("un organe ajouté par la team sans position n'a pas de point", () => {
    expect(pointPourOrgane("citadine_3p_saxo", { cle: null, positions: null })).toBeNull()
  })
})

describe("position enregistrée par la team", () => {
  it("prime sur la position par défaut pour le même gabarit", () => {
    const enregistree = { citadine_3p_saxo: { x: 100, y: 50 } }
    expect(pointPourOrgane("citadine_3p_saxo", { cle: "moteur", positions: enregistree })).toEqual({ x: 100, y: 50 })
  })

  it("ne s'applique qu'à son propre gabarit", () => {
    const enregistree = { citadine_3p_saxo: { x: 100, y: 50 } }
    expect(pointPourOrgane("voiture_generique", { cle: null, positions: enregistree })).toBeNull()
  })

  it("une valeur invalide est ignorée, et la position par défaut prend le relais", () => {
    const invalide = { citadine_3p_saxo: { x: "cent", y: 50 } }
    expect(pointPourOrgane("citadine_3p_saxo", { cle: "moteur", positions: invalide })).toEqual({ x: 250, y: 84 })
  })
})

describe("pointValide", () => {
  it("accepte deux nombres finis", () => {
    expect(pointValide({ x: 1, y: -2 })).toEqual({ x: 1, y: -2 })
  })

  it("refuse les valeurs non numériques, infinies ou absentes", () => {
    expect(pointValide({ x: Number.NaN, y: 1 })).toBeNull()
    expect(pointValide({ x: Number.POSITIVE_INFINITY, y: 1 })).toBeNull()
    expect(pointValide({ x: 1 })).toBeNull()
    expect(pointValide(null)).toBeNull()
    expect(pointValide("12")).toBeNull()
  })
})
