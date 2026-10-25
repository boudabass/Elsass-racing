import { describe, expect, it } from "vitest"

import {
  epreuvesAssistance,
  epreuvesAssistanceIds,
  epreuvesDuPalier,
  NOMBRE_RESSENTIS_MOYENNE,
  palierDepuis,
  ressentiMoyen,
  roleAffectable,
  statistiquesBinome,
  statistiquesPersonne,
  statutEquipement,
  statutLicence,
  validiteCoherente,
  type ResultatValide,
} from "./regles"

// Dates de colonne `date` : minuit UTC, comme Prisma les rend. « Aujourd'hui » : le 25 octobre 2026, à Paris.
const MAINTENANT = new Date("2026-10-25T12:00:00Z")
const dansJours = (jours: number) => new Date(Date.parse("2026-10-25T00:00:00Z") + jours * 86_400_000)

describe("statut d'une licence et d'un équipement", () => {
  it("valide au-delà de 30 jours, à renouveler jusqu'à 30 jours inclus, expirée après la date", () => {
    expect(statutLicence(dansJours(31), MAINTENANT)).toBe("valide")
    expect(statutLicence(dansJours(30), MAINTENANT)).toBe("a_renouveler")
    expect(statutLicence(dansJours(0), MAINTENANT)).toBe("a_renouveler")
    expect(statutLicence(dansJours(-1), MAINTENANT)).toBe("expire")
  })

  it("sans date de fin, pas d'expiration", () => {
    expect(statutLicence(null, MAINTENANT)).toBe("valide")
    expect(statutEquipement(null, MAINTENANT)).toBe("valide")
  })

  it("un équipement suit la même règle sur sa fin d'homologation", () => {
    expect(statutEquipement(dansJours(10), MAINTENANT)).toBe("a_renouveler")
    expect(statutEquipement(dansJours(-3), MAINTENANT)).toBe("expire")
  })
})

describe("palier d'expérience", () => {
  it("se calcule sur le nombre d'épreuves, aux seuils 0, 5, 15, 30 et 60", () => {
    expect(palierDepuis(0, "rookie")).toBe("rookie")
    expect(palierDepuis(4, "rookie")).toBe("rookie")
    expect(palierDepuis(5, "rookie")).toBe("confirme")
    expect(palierDepuis(15, "rookie")).toBe("experimente")
    expect(palierDepuis(30, "rookie")).toBe("veteran")
    expect(palierDepuis(60, "rookie")).toBe("figure")
    expect(palierDepuis(999, "rookie")).toBe("figure")
  })

  it("ne descend jamais : un palier déjà atteint est gardé, même si le nombre d'épreuves baisse", () => {
    expect(palierDepuis(3, "confirme")).toBe("confirme")
    expect(palierDepuis(0, "veteran")).toBe("veteran")
  })

  it("compte les épreuves d'assistance où la personne était affectée et a dit « vient », sans doublon", () => {
    expect(epreuvesAssistance(["a", "b", "c"], ["b", "c", "d"])).toBe(2)
    expect(epreuvesAssistance(["a", "a"], ["a"])).toBe(1)
    expect(epreuvesAssistance(["a"], [])).toBe(0)
  })

  it("une épreuve d'équipage et d'assistance compte une seule fois pour le palier", () => {
    expect(epreuvesDuPalier(["a", "b"], ["b", "c"])).toBe(3)
    expect(epreuvesDuPalier([], ["a"])).toBe(1)
    expect(epreuvesAssistanceIds(["a", "b"], ["b", "b"])).toEqual(["b"])
  })
})

const arrivee = (classementClasse: number | null, km: number, classementGeneral: number | null = null): ResultatValide => ({
  statutFinal: "arrivee",
  classementGeneral,
  classementClasse,
  kmSpeciale: km,
})
const abandon: ResultatValide = { statutFinal: "abandon", classementGeneral: null, classementClasse: null, kmSpeciale: 0 }

describe("statistiques d'une personne", () => {
  it("compte les épreuves, les arrivées, le taux d'arrivée, les km et le meilleur classement de classe", () => {
    const stats = statistiquesPersonne([arrivee(4, 40), arrivee(2, 25), abandon])
    expect(stats).toEqual({ epreuves: 3, arrivees: 2, tauxArrivee: 2 / 3, kmChronometres: 65, meilleurClassement: 2 })
  })

  it("sans épreuve : zéros, et pas de taux ni de classement", () => {
    expect(statistiquesPersonne([])).toEqual({ epreuves: 0, arrivees: 0, tauxArrivee: null, kmChronometres: 0, meilleurClassement: null })
  })

  it("une arrivée sans classement de classe n'a pas de meilleur classement", () => {
    expect(statistiquesPersonne([arrivee(null, 10)]).meilleurClassement).toBeNull()
  })
})

describe("statistiques d'un binôme", () => {
  it("compte les épreuves communes, les km et les arrivées ensemble, et le meilleur résultat ensemble", () => {
    const stats = statistiquesBinome([arrivee(null, 30, 7), arrivee(null, 20, 3), abandon])
    expect(stats).toEqual({ epreuvesCommunes: 3, kmEnsemble: 50, arriveesEnsemble: 2, meilleurResultat: 3 })
  })

  it("sans épreuve commune : zéros et pas de meilleur résultat", () => {
    expect(statistiquesBinome([])).toEqual({ epreuvesCommunes: 0, kmEnsemble: 0, arriveesEnsemble: 0, meilleurResultat: null })
  })
})

describe("ressenti moyen", () => {
  it("fait la moyenne des derniers débriefs, arrondie au dixième", () => {
    expect(ressentiMoyen([5, 4, 4])).toBe(4.3)
    expect(ressentiMoyen([3])).toBe(3)
  })

  it("ne compte que les NOMBRE_RESSENTIS_MOYENNE derniers, du plus récent au plus ancien", () => {
    expect(NOMBRE_RESSENTIS_MOYENNE).toBe(5)
    // Les 5 premiers (récents) valent 5 ; le plus ancien à 1 n'entre pas dans la moyenne.
    expect(ressentiMoyen([5, 5, 5, 5, 5, 1])).toBe(5)
  })

  it("sans ressenti : null", () => {
    expect(ressentiMoyen([])).toBeNull()
  })
})

describe("cohérence d'une validité de licence", () => {
  it("la fin ne peut pas être avant le début ; un trou n'est pas une incohérence", () => {
    expect(validiteCoherente("2026-01-01", "2026-12-31")).toBe(true)
    expect(validiteCoherente("2026-01-01", "2026-01-01")).toBe(true)
    expect(validiteCoherente("2026-12-31", "2026-01-01")).toBe(false)
    expect(validiteCoherente(null, "2026-01-01")).toBe(true)
    expect(validiteCoherente("2026-01-01", null)).toBe(true)
  })
})

describe("rôles d'épreuve affectables", () => {
  it("pilote et copilote ne s'affectent pas ici, les autres rôles oui", () => {
    expect(roleAffectable("pilote")).toBe(false)
    expect(roleAffectable("copilote")).toBe(false)
    expect(roleAffectable("chef_assistance")).toBe(true)
    expect(roleAffectable("assistance")).toBe(true)
    expect(roleAffectable("logistique")).toBe(true)
    expect(roleAffectable("photo")).toBe(true)
  })
})
