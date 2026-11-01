import { describe, expect, it } from "vitest"

import { comparerEcheance, phaseSuivante, prochaineEtape, type CandidatEtape } from "./prochaine-etape"

const candidat = (surcharge: Partial<CandidatEtape> & Pick<CandidatEtape, "raison">): CandidatEtape => ({
  listeId: "liste-1",
  listeTitre: "Commune",
  pointId: "point-1",
  libelle: "Point",
  echeance: "2026-11-10",
  ...surcharge,
})

describe("prochaine étape de Check-lists (5.6 §3)", () => {
  it("un point critique passe avant mes points, et mes points avant la phase suivante", () => {
    const choisi = prochaineEtape([
      candidat({ raison: "phase_suivante", pointId: null, libelle: null, echeance: "2026-11-01" }),
      candidat({ raison: "pour_moi", echeance: "2026-11-01" }),
      candidat({ raison: "critique", pointId: "critique", echeance: "2026-11-20" }),
    ])
    expect(choisi?.raison).toBe("critique")
    expect(choisi?.pointId).toBe("critique")
  })

  it("entre deux points critiques, celui dont la liste est la plus proche de son échéance", () => {
    const choisi = prochaineEtape([
      candidat({ raison: "critique", pointId: "tard", echeance: "2026-11-20" }),
      candidat({ raison: "critique", pointId: "tot", echeance: "2026-11-03" }),
    ])
    expect(choisi?.pointId).toBe("tot")
  })

  it("une échéance absente passe après toute échéance connue", () => {
    const choisi = prochaineEtape([
      candidat({ raison: "critique", pointId: "sans", echeance: null }),
      candidat({ raison: "critique", pointId: "avec", echeance: "2026-12-31" }),
    ])
    expect(choisi?.pointId).toBe("avec")
  })

  it("à égalité, le premier de la liste gagne", () => {
    const choisi = prochaineEtape([
      candidat({ raison: "pour_moi", pointId: "premier" }),
      candidat({ raison: "pour_moi", pointId: "second" }),
    ])
    expect(choisi?.pointId).toBe("premier")
  })

  it("rien à faire donne null", () => {
    expect(prochaineEtape([])).toBeNull()
  })

  it("la phase suivante se lit dans l'ordre des phases, et s'arrête après le retour", () => {
    expect(phaseSuivante("avant_depart")).toBe("verifications")
    expect(phaseSuivante("epreuve")).toBe("retour")
    expect(phaseSuivante("retour")).toBeNull()
  })

  it("l'échéance se compare en date, la plus tôt d'abord", () => {
    expect(comparerEcheance("2026-11-01", "2026-11-02")).toBeLessThan(0)
    expect(comparerEcheance("2026-11-02", "2026-11-01")).toBeGreaterThan(0)
    expect(comparerEcheance(null, "2026-11-01")).toBeGreaterThan(0)
    expect(comparerEcheance("2026-11-01", null)).toBeLessThan(0)
    expect(comparerEcheance(null, null)).toBe(0)
  })
})
