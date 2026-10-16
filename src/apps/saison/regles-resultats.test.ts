import { describe, expect, it } from "vitest"

import {
  bilanSaison,
  formaterDuree,
  parserDuree,
  peutVoirDebriefs,
  refusEcritureSaison,
  ressentiValide,
  statistiquesCarriere,
  type ResultatCarriere,
} from "./regles-resultats"

const base: ResultatCarriere = {
  epreuveId: "e1",
  piloteId: "p1",
  copiloteId: "p2",
  voitureId: "v1",
  validation: "valide",
  statutFinal: "arrivee",
  kmChronometres: 40,
  classementClasse: 3,
}

describe("durées mm:ss,d", () => {
  it("convertit une saisie en millisecondes", () => {
    expect(parserDuree("1:23,4")).toBe(83_400)
    expect(parserDuree("0:00,0")).toBe(0)
    expect(parserDuree("12:05")).toBe(725_000)
  })

  it("refuse une saisie vide ou mal formée", () => {
    expect(parserDuree("")).toBeNull()
    expect(parserDuree("   ")).toBeNull()
    expect(parserDuree("83,4")).toBeNull()
    expect(parserDuree("1:60,0")).toBeNull()
    expect(parserDuree("1:23.4")).toBeNull()
  })

  it("revient à la saisie par aller-retour", () => {
    for (const saisie of ["1:23,4", "0:05,0", "10:59,9"]) {
      expect(formaterDuree(parserDuree(saisie) as number)).toBe(saisie)
    }
  })

  it("tronque les millisecondes au dixième à l'affichage", () => {
    expect(formaterDuree(83_499)).toBe("1:23,4")
  })
})

describe("statistiquesCarriere", () => {
  it("un résultat non validé ne compte jamais", () => {
    const { personnes, voitures } = statistiquesCarriere([
      { ...base, validation: "saisi" },
      { ...base, epreuveId: "e2", validation: "a_verifier" },
      { ...base, epreuveId: "e3", validation: "conteste" },
    ])
    expect(personnes).toEqual([])
    expect(voitures).toEqual([])
  })

  it("compte épreuves, arrivées, taux, km et meilleur classement de classe", () => {
    const resultats: ResultatCarriere[] = [
      { ...base, epreuveId: "e1", statutFinal: "arrivee", kmChronometres: 40, classementClasse: 5 },
      { ...base, epreuveId: "e2", statutFinal: "abandon", kmChronometres: 12.5, classementClasse: null },
      { ...base, epreuveId: "e3", statutFinal: "arrivee", kmChronometres: 30, classementClasse: 2 },
    ]
    const { voitures } = statistiquesCarriere(resultats)
    expect(voitures).toEqual([
      { cle: "v1", epreuves: 3, arrivees: 2, tauxArrivee: 66, km: 82.5, meilleurClassementClasse: 2 },
    ])
  })

  it("compte le pilote et le copilote séparément, et le taux est nul sans épreuve validée", () => {
    const { personnes } = statistiquesCarriere([{ ...base, copiloteId: null }])
    expect(personnes.map((p) => p.cle)).toEqual(["p1"])
    expect(statistiquesCarriere([]).personnes).toEqual([])
  })

  it("un même résultat n'ajoute qu'une épreuve à la personne", () => {
    const { personnes } = statistiquesCarriere([base, { ...base, statutFinal: "abandon" }])
    expect(personnes.find((p) => p.cle === "p1")?.epreuves).toBe(1)
  })
})

describe("bilanSaison", () => {
  it("ne compte les arrivées, abandons et km que sur les résultats validés", () => {
    const bilan = bilanSaison([
      { statut: "arrivee", validation: "valide", statutFinal: "arrivee", kmChronometres: 20 },
      { statut: "abandon", validation: "valide", statutFinal: "abandon", kmChronometres: 5 },
      { statut: "parti", validation: "a_verifier", statutFinal: "arrivee", kmChronometres: 99 },
      { statut: "envisage", validation: null, statutFinal: null, kmChronometres: null },
    ])
    expect(bilan).toEqual({ partis: 3, arrivees: 1, abandons: 1, km: 25 })
  })
})

describe("écriture sur saison clôturée", () => {
  it("refuse avec un message clair dès que la saison est clôturée", () => {
    expect(refusEcritureSaison(new Date("2026-12-31T10:00:00Z"))).toMatch(/clôturée/)
  })

  it("laisse passer une saison ouverte", () => {
    expect(refusEcritureSaison(null)).toBeNull()
  })
})

describe("débrief", () => {
  it("l'assistance ne voit pas les débriefs, ni le responsable ni l'équipage", () => {
    expect(peutVoirDebriefs("assistance")).toBe(false)
    expect(peutVoirDebriefs("invite")).toBe(false)
    expect(peutVoirDebriefs("responsable")).toBe(true)
    expect(peutVoirDebriefs("equipage")).toBe(true)
  })

  it("le ressenti va de 1 à 5, entier", () => {
    expect([1, 3, 5].every(ressentiValide)).toBe(true)
    expect(ressentiValide(0)).toBe(false)
    expect(ressentiValide(6)).toBe(false)
    expect(ressentiValide(2.5)).toBe(false)
  })
})
