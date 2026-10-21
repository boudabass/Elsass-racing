import { describe, expect, it } from "vitest"

import { avancementValide, comparerOrdres, coutValide, statutModifiable, type OrdreTri } from "./travaux"

const ordre = (titre: string, priorite: OrdreTri["priorite"], aFaireAvant: string | null = null): OrdreTri => ({
  titre,
  priorite,
  aFaireAvant,
})

describe("tri des travaux", () => {
  it("place la priorité d'abord : haute, normale, basse", () => {
    const liste = [ordre("C", "basse"), ordre("A", "haute"), ordre("B", "normale")]
    expect(liste.sort(comparerOrdres).map((o) => o.titre)).toEqual(["A", "B", "C"])
  })

  it("à priorité égale, la date « à faire avant » la plus proche passe en premier", () => {
    const liste = [ordre("tardif", "normale", "2026-11-10"), ordre("proche", "normale", "2026-10-30")]
    expect(liste.sort(comparerOrdres).map((o) => o.titre)).toEqual(["proche", "tardif"])
  })

  it("une date absente va en dernier, à priorité égale", () => {
    const liste = [ordre("sans date", "normale", null), ordre("avec date", "normale", "2026-12-01")]
    expect(liste.sort(comparerOrdres).map((o) => o.titre)).toEqual(["avec date", "sans date"])
  })

  it("à priorité et date égales, le titre départage", () => {
    const liste = [ordre("Vidange", "normale"), ordre("Amortisseurs", "normale")]
    expect(liste.sort(comparerOrdres).map((o) => o.titre)).toEqual(["Amortisseurs", "Vidange"])
  })
})

describe("validation des saisies de travaux", () => {
  it("l'avancement est un entier de 0 à 100", () => {
    expect(avancementValide(0)).toBe(true)
    expect(avancementValide(100)).toBe(true)
    expect(avancementValide(101)).toBe(false)
    expect(avancementValide(-1)).toBe(false)
    expect(avancementValide(42.5)).toBe(false)
  })

  it("le coût est un entier de centimes positif ou nul, ou absent", () => {
    expect(coutValide(null)).toBe(true)
    expect(coutValide(0)).toBe(true)
    expect(coutValide(12000)).toBe(true)
    expect(coutValide(-100)).toBe(false)
    expect(coutValide(10.5)).toBe(false)
  })

  it("un ordre terminé n'est plus modifiable par son statut (D3)", () => {
    expect(statutModifiable("prevu")).toBe(true)
    expect(statutModifiable("en_cours")).toBe(true)
    expect(statutModifiable("termine")).toBe(false)
  })
})
