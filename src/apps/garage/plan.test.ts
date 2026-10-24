import { describe, expect, it } from "vitest"

import { compterZones, estimationApresEpreuve, totalPrevus } from "./plan"
import { SEUILS_DEFAUT, type DureesVie, type ModeUsure, type SaisieEtat, type Usure } from "./regles"

const durees: DureesVie = { km: 10000, epreuves: 10 }

function estimer(mode: ModeUsure, usure: Usure, kmPrevus: number | null, options: { durees?: DureesVie; saisie?: SaisieEtat | null } = {}) {
  return estimationApresEpreuve({
    mode,
    durees: options.durees ?? durees,
    usure,
    saisie: options.saisie ?? null,
    seuils: SEUILS_DEFAUT,
    kmPrevus,
  })
}

describe("estimationApresEpreuve", () => {
  it("mode km : l'état après l'épreuve compte les km prévus", () => {
    // Aujourd'hui 10 % (9 000 km sur 10 000). Après 500 km de plus (9 500 km) : 5 %, en zone rouge.
    expect(estimer("km", { km: 9000, epreuves: 0 }, 500)).toEqual({ statut: "estimee", etat: 5, zone: "rouge" })
  })

  it("mode épreuves : une épreuve de plus, sans longueur de spéciale", () => {
    // 4 épreuves sur 10 : 60 % aujourd'hui, 50 % après l'épreuve.
    expect(estimer("epreuves", { km: 0, epreuves: 4 }, null)).toEqual({ statut: "estimee", etat: 50, zone: "vert" })
  })

  it("mode épreuves, même avec des km prévus : les km ne comptent pas", () => {
    expect(estimer("epreuves", { km: 0, epreuves: 4 }, 500)).toEqual({ statut: "estimee", etat: 50, zone: "vert" })
  })

  it("mode km sans longueur de spéciale : pas d'estimation, le dit", () => {
    expect(estimer("km", { km: 9000, epreuves: 0 }, null)).toEqual({ statut: "sans_km" })
  })

  it("les deux modes sans longueur : pas d'estimation (la partie km manque)", () => {
    expect(estimer("les_deux", { km: 1000, epreuves: 1 }, null)).toEqual({ statut: "sans_km" })
  })

  it("les deux modes : le plus bas des deux, km et épreuves", () => {
    // Km : 100 − 9 500 ÷ 10 000 × 100 = 5 %. Épreuves : 100 − 6 × 10 = 40 %. Le plus bas : 5 %.
    expect(estimer("les_deux", { km: 9000, epreuves: 5 }, 500)).toEqual({ statut: "estimee", etat: 5, zone: "rouge" })
  })

  it("une durée de vie manquante : l'état n'est pas connu aujourd'hui, donc pas d'estimation", () => {
    expect(estimer("km", { km: 9000, epreuves: 0 }, 500, { durees: { km: null, epreuves: null } })).toEqual({ statut: "a_renseigner" })
  })

  it("avec une saisie après réparation, l'usure compte depuis la saisie", () => {
    // Réparé à 80 % à 1 000 km. À 1 500 km : 75 %. Après 200 km de plus : 80 − 700 ÷ 10 000 × 100 = 73 %.
    const saisie: SaisieEtat = { etatPct: 80, kmAuSaisie: 1000, epreuvesAuSaisie: 0, saisiLe: new Date("2026-10-20T10:00:00Z") }
    expect(estimer("km", { km: 1500, epreuves: 0 }, 200, { saisie })).toEqual({ statut: "estimee", etat: 73, zone: "vert" })
  })

  it("l'estimation ne descend jamais sous 0 %", () => {
    expect(estimer("km", { km: 15000, epreuves: 0 }, 500)).toEqual({ statut: "estimee", etat: 0, zone: "rouge" })
  })
})

describe("compterZones", () => {
  it("compte les zones, et les « À renseigner » à part", () => {
    expect(compterZones(["rouge", "orange", "vert", "vert", "a_renseigner"])).toEqual({ rouge: 1, surveiller: 1, vert: 2, aRenseigner: 1 })
  })
})

describe("totalPrevus", () => {
  const ordres = [
    { dureeEstimeeMinutes: 90, coutMainOeuvreCents: 6000 },
    { dureeEstimeeMinutes: null, coutMainOeuvreCents: null },
  ]

  it("hors niveau écriture, le coût reste absent", () => {
    expect(totalPrevus(ordres, false)).toEqual({ dureeMinutes: 90, coutCents: null })
  })

  it("au niveau écriture, somme la durée et le coût des ordres prévus", () => {
    expect(totalPrevus(ordres, true)).toEqual({ dureeMinutes: 90, coutCents: 6000 })
  })
})
