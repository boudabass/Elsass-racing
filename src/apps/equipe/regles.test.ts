import { describe, expect, it } from "vitest"

import {
  binomesDePersonne,
  epreuvesAssistance,
  epreuvesAssistanceIds,
  epreuvesDuPalier,
  estEquipage,
  homologationValideA,
  licenceValideA,
  NOMBRE_RESSENTIS_MOYENNE,
  LIBELLES_ROLE_EPREUVE,
  palierDepuis,
  progressionPalier,
  peutChangerTache,
  ressentiMoyen,
  ROLES_EPREUVE,
  roleAffectable,
  statistiquesBinome,
  statistiquesPersonne,
  statutEquipement,
  statutLePlusUrgent,
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
  it("compte les épreuves, les arrivées, le taux d'arrivée, les km et les meilleurs rangs (scratch et classe)", () => {
    const stats = statistiquesPersonne([arrivee(4, 40, 9), arrivee(2, 25, 12), abandon])
    expect(stats).toEqual({ epreuves: 3, arrivees: 2, tauxArrivee: 2 / 3, kmChronometres: 65, meilleurScratch: 9, meilleurClasse: 2 })
  })

  it("le scratch et la classe se lisent séparément : une arrivée sans rang au scratch garde son rang de classe", () => {
    expect(statistiquesPersonne([arrivee(3, 10)])).toMatchObject({ meilleurScratch: null, meilleurClasse: 3 })
  })

  it("sans épreuve : zéros, et pas de taux ni de rang", () => {
    expect(statistiquesPersonne([])).toEqual({
      epreuves: 0,
      arrivees: 0,
      tauxArrivee: null,
      kmChronometres: 0,
      meilleurScratch: null,
      meilleurClasse: null,
    })
  })

  it("une arrivée sans classement de classe n'a pas de meilleure classe", () => {
    expect(statistiquesPersonne([arrivee(null, 10)]).meilleurClasse).toBeNull()
  })
})

describe("statistiques d'un binôme", () => {
  it("compte les épreuves communes, les km et les arrivées ensemble, et les meilleurs rangs ensemble", () => {
    const stats = statistiquesBinome([arrivee(null, 30, 7), arrivee(null, 20, 3), abandon])
    expect(stats).toEqual({ epreuvesCommunes: 3, kmEnsemble: 50, arriveesEnsemble: 2, meilleurScratch: 3, meilleurClasse: null })
  })

  it("sans épreuve commune : zéros et pas de rang", () => {
    expect(statistiquesBinome([])).toEqual({
      epreuvesCommunes: 0,
      kmEnsemble: 0,
      arriveesEnsemble: 0,
      meilleurScratch: null,
      meilleurClasse: null,
    })
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

describe("pastille d'échéances", () => {
  it("garde la plus urgente ; sans échéance suivie, rien", () => {
    expect(statutLePlusUrgent(["valide", "a_renouveler", "valide"])).toBe("a_renouveler")
    expect(statutLePlusUrgent(["expire", "a_renouveler"])).toBe("expire")
    expect(statutLePlusUrgent(["valide"])).toBe("valide")
    expect(statutLePlusUrgent([])).toBeNull()
  })
})

describe("validite a une date donnee (epreuve, pas aujourd'hui)", () => {
  const epreuve = new Date("2026-11-07T00:00:00Z")
  const jour = (iso: string) => new Date(`${iso}T00:00:00Z`)

  it("licence : valable le jour de l'épreuve, bornes incluses", () => {
    expect(licenceValideA(jour("2026-01-01"), jour("2026-11-07"), epreuve)).toBe(true)
    expect(licenceValideA(null, jour("2026-11-07"), epreuve)).toBe(true)
  })

  it("licence qui expire avant l'épreuve, ou pas encore commencée, n'est pas valable", () => {
    expect(licenceValideA(null, jour("2026-11-03"), epreuve)).toBe(false)
    expect(licenceValideA(jour("2026-11-10"), null, epreuve)).toBe(false)
  })

  it("licence sans date : pas d'expiration", () => {
    expect(licenceValideA(null, null, epreuve)).toBe(true)
  })

  it("homologation : valable tant que sa fin n'est pas passée le jour de l'épreuve", () => {
    expect(homologationValideA(jour("2026-11-07"), epreuve)).toBe(true)
    expect(homologationValideA(jour("2026-11-06"), epreuve)).toBe(false)
    expect(homologationValideA(null, epreuve)).toBe(true)
  })
})

describe("tâches liées aux affectations", () => {
  it("chaque rôle d'épreuve a son titre de tâche", () => {
    for (const role of ROLES_EPREUVE) expect(LIBELLES_ROLE_EPREUVE[role]).toBeTruthy()
    expect(LIBELLES_ROLE_EPREUVE.chef_assistance).toBe("Chef d'assistance")
  })

  it("la personne assignée change sa tâche, même en niveau contribution", () => {
    expect(peutChangerTache("contribution", "anne", "anne")).toBe(true)
  })

  it("l'assistance ne change pas la tâche d'une autre personne : le refus est dit", () => {
    expect(peutChangerTache("contribution", "anne", "luc")).toBe(false)
    expect(peutChangerTache("lecture", null, "luc")).toBe(false)
  })

  it("le niveau écriture change toute tâche de l'équipe", () => {
    expect(peutChangerTache("ecriture", "anne", "luc")).toBe(true)
    expect(peutChangerTache("gestion", null, null)).toBe(true)
  })
})

describe("progression vers le palier suivant", () => {
  it("à mi-chemin entre confirmé (5) et expérimenté (15) : 50 %, restant 5", () => {
    expect(progressionPalier(10, "confirme")).toEqual({ suivant: "experimente", restant: 5, pourcentage: 50 })
  })

  it("au dernier palier : rien à atteindre", () => {
    expect(progressionPalier(80, "figure")).toBeNull()
  })

  it("ne dépasse ni 100 % ni un restant négatif quand le palier est déjà atteint sans les épreuves", () => {
    expect(progressionPalier(2, "confirme")).toEqual({ suivant: "experimente", restant: 13, pourcentage: 0 })
    expect(progressionPalier(20, "rookie")).toEqual({ suivant: "confirme", restant: 0, pourcentage: 100 })
  })
})

describe("équipage et binômes (fiche, cartes)", () => {
  it("est équipage un pilote ou un copilote, pas l'assistance ni le bénévole seuls", () => {
    expect(estEquipage(["pilote"])).toBe(true)
    expect(estEquipage(["assistance", "copilote"])).toBe(true)
    expect(estEquipage(["assistance"])).toBe(false)
    expect(estEquipage(["benevole"])).toBe(false)
    expect(estEquipage([])).toBe(false)
  })

  it("ne garde que les binômes où la personne figure, pilote ou copilote", () => {
    const binomes = [
      { piloteId: "a", copiloteId: "b" },
      { piloteId: "c", copiloteId: "a" },
      { piloteId: "c", copiloteId: "d" },
    ]
    expect(binomesDePersonne("a", binomes)).toEqual([binomes[0], binomes[1]])
    expect(binomesDePersonne("d", binomes)).toEqual([binomes[2]])
    expect(binomesDePersonne("z", binomes)).toEqual([])
  })
})
