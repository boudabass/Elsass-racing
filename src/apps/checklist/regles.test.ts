import { describe, expect, it } from "vitest"

import {
  ajouterJours,
  assistancePeut,
  avancementPourcent,
  calculerListe,
  disciplineDeType,
  echeanceDeListe,
  echeanceProche,
  epreuveCommencee,
  fautSignalerPointCritique,
  fautSignalerProbleme,
  jourParis,
  listeTermineeAEmettre,
  listeVisiblePour,
  doitProposerReassignation,
  pointEnAttente,
  reassignationLevee,
  modelesVisiblesPour,
  phaseEnCours,
  avertissementAvantPhase,
  pointsCritiquesOuverts,
  statutDeListe,
  zoneDeListe,
  type ListePhasee,
  type PointRegle,
} from "./regles"

const point = (statut: PointRegle["statut"], critique = false): PointRegle => ({ statut, critique })
const sansPoints = (nombre: number, statut: PointRegle["statut"]): PointRegle[] => Array.from({ length: nombre }, () => point(statut))

describe("avancement d'une liste", () => {
  it("un point critique compte double", () => {
    // Un critique fait (poids 2) sur deux normaux à faire : 2 / 4.
    expect(avancementPourcent([point("fait", true), point("a_faire"), point("a_faire")])).toBe(50)
    // Un critique à faire (poids 2) et un normal fait : 1 / 3.
    expect(avancementPourcent([point("a_faire", true), point("fait")])).toBe(33)
  })

  it("un point en problème compte comme non fait", () => {
    expect(avancementPourcent([point("probleme"), point("fait")])).toBe(50)
    // Critique en problème (poids 2, non fait) et normal fait : 1 / 3.
    expect(avancementPourcent([point("probleme", true), point("fait")])).toBe(33)
  })

  it("un point sans objet compte comme fait", () => {
    expect(avancementPourcent([point("sans_objet"), point("fait")])).toBe(100)
    expect(avancementPourcent([point("sans_objet"), point("a_faire")])).toBe(50)
  })

  it("une liste vide vaut 0 % sans erreur", () => {
    expect(avancementPourcent([])).toBe(0)
    expect(calculerListe([])).toMatchObject({ avancement: 0, zone: "orange", statut: "a_faire", critiquesOuverts: 0 })
  })

  it("une liste faite seulement de sans objet vaut 100 %", () => {
    expect(avancementPourcent([point("sans_objet"), point("sans_objet", true)])).toBe(100)
  })
})

describe("zone d'une liste", () => {
  it("89 % sans critique ouvert : orange", () => {
    // 8 faits sur 9 normaux : 88,9 %, arrondi à 89 : orange.
    const liste = [...sansPoints(8, "fait"), point("a_faire")]
    expect(avancementPourcent(liste)).toBe(89)
    expect(zoneDeListe(liste)).toBe("orange")
  })

  it("90 % sans critique : vert", () => {
    const liste = [...sansPoints(9, "fait"), point("a_faire")]
    expect(zoneDeListe(liste)).toBe("vert")
  })

  it("au-dessus du seuil, un critique en problème garde la zone orange", () => {
    // 19 normaux faits et un critique en problème : 19 / 21 = 90,5 %, mais un critique est ouvert.
    const liste = [...sansPoints(19, "fait"), point("probleme", true)]
    expect(avancementPourcent(liste)).toBe(90)
    expect(zoneDeListe(liste)).toBe("orange")
  })

  it("la zone porte sur le ratio exact, pas sur l'arrondi affiché", () => {
    // 179 faits sur 199 : 89,95 %, affiché 90, mais en dessous du seuil de 90 % : orange.
    const liste = [...sansPoints(179, "fait"), ...sansPoints(20, "a_faire")]
    expect(avancementPourcent(liste)).toBe(90)
    expect(zoneDeListe(liste)).toBe("orange")
  })

  it("jamais de rouge : une liste vide ou incomplète reste orange", () => {
    expect(zoneDeListe([])).toBe("orange")
    expect(zoneDeListe(sansPoints(3, "a_faire"))).toBe("orange")
  })
})

describe("statut d'une liste", () => {
  it("à faire quand rien n'a avancé", () => {
    expect(statutDeListe([point("a_faire"), point("probleme")])).toBe("a_faire")
  })

  it("en cours dès qu'un point avance sans que tous soient traités", () => {
    expect(statutDeListe([point("fait"), point("a_faire")])).toBe("en_cours")
  })

  it("terminée quand tous les points sont faits ou sans objet", () => {
    expect(statutDeListe([point("fait"), point("sans_objet")])).toBe("terminee")
    expect(statutDeListe([point("sans_objet")])).toBe("terminee")
  })

  it("une liste en problème n'est jamais terminée", () => {
    expect(statutDeListe([point("fait"), point("probleme")])).toBe("en_cours")
  })
})

describe("points critiques ouverts", () => {
  it("ce sont les critiques à faire ou en problème", () => {
    const ouverts = pointsCritiquesOuverts([
      point("a_faire", true),
      point("probleme", true),
      point("fait", true),
      point("a_faire"),
    ])
    expect(ouverts).toHaveLength(2)
  })
})

describe("échéance d'une liste", () => {
  it("prend la première échéance du modèle, c'est-à-dire le plus grand décalage", () => {
    // Épreuve le 2026-11-14 : J-7 donne le 7 novembre, la première échéance du modèle.
    expect(echeanceDeListe("2026-11-14", ["jour_j", "j_moins_7", "j_moins_1"])).toBe("2026-11-07")
  })

  it("sans point à échéance relative, pas d'échéance et pas d'erreur", () => {
    expect(echeanceDeListe("2026-11-14", [null, null])).toBeNull()
    expect(echeanceDeListe("2026-11-14", [])).toBeNull()
  })

  it("le calcul traverse un changement de mois", () => {
    expect(ajouterJours("2026-11-03", -7)).toBe("2026-10-27")
    expect(echeanceDeListe("2026-03-02", ["j_moins_7"])).toBe("2026-02-23")
  })

  it("une échéance à 7 jours ou moins est proche, une échéance passée aussi", () => {
    expect(echeanceProche("2026-11-07", "2026-11-01")).toBe(true)
    // Sept jours : 7 jours ou moins, donc proche. Huit jours : pas encore.
    expect(echeanceProche("2026-11-08", "2026-11-01")).toBe(true)
    expect(echeanceProche("2026-11-09", "2026-11-01")).toBe(false)
    expect(echeanceProche("2026-10-30", "2026-11-01")).toBe(true)
    expect(echeanceProche(null, "2026-11-01")).toBe(false)
  })

  it("le jour calendaire est celui de Paris, pas celui de UTC", () => {
    // 23 h 30 UTC le 1er novembre est déjà le 2 novembre à Paris.
    expect(jourParis(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02")
    expect(jourParis(new Date("2026-11-01T10:00:00Z"))).toBe("2026-11-01")
  })

  it("l'épreuve a commencé à partir de sa date de début", () => {
    expect(epreuveCommencee("2026-11-14", "2026-11-13")).toBe(false)
    expect(epreuveCommencee("2026-11-14", "2026-11-14")).toBe(true)
  })
})

describe("événements", () => {
  it("un point critique qui passe en problème est signalé, un point normal non", () => {
    expect(fautSignalerPointCritique({ ancien: "a_faire", nouveau: "probleme", critique: true, ajoute: false }, null, "2026-11-01")).toBe(true)
    expect(fautSignalerPointCritique({ ancien: "a_faire", nouveau: "probleme", critique: false, ajoute: false }, null, "2026-11-01")).toBe(false)
  })

  it("un problème déjà signalé n'est pas signalé à nouveau", () => {
    expect(fautSignalerProbleme("probleme", "probleme")).toBe(false)
    expect(fautSignalerProbleme("fait", "probleme")).toBe(true)
  })

  it("un point critique ajouté à une liste proche de son échéance est signalé", () => {
    const ajout = { ancien: null, nouveau: "a_faire" as const, critique: true, ajoute: true }
    expect(fautSignalerPointCritique(ajout, "2026-11-05", "2026-11-01")).toBe(true)
    expect(fautSignalerPointCritique(ajout, "2026-11-20", "2026-11-01")).toBe(false)
  })

  it("liste terminée : une fois par liste et par jour (Paris)", () => {
    expect(listeTermineeAEmettre([], "2026-11-01")).toBe(true)
    expect(listeTermineeAEmettre(["2026-11-01"], "2026-11-01")).toBe(false)
    // Repassée en cours puis terminée un autre jour : nouvel envoi.
    expect(listeTermineeAEmettre(["2026-10-31"], "2026-11-01")).toBe(true)
  })
})

describe("discipline de l'épreuve", () => {
  it("rallye, course de côte et slalom correspondent à leur discipline", () => {
    expect(disciplineDeType("rallye")).toBe("rallye")
    expect(disciplineDeType("course_de_cote")).toBe("course_de_cote")
    expect(disciplineDeType("slalom")).toBe("slalom")
  })

  it("expo, roulage et autre n'ont pas de discipline, et circuit n'existe pas encore dans le socle", () => {
    expect(disciplineDeType("expo")).toBeNull()
    expect(disciplineDeType("roulage")).toBeNull()
    expect(disciplineDeType("autre")).toBeNull()
    expect(disciplineDeType("circuit")).toBeNull()
  })
})

describe("droits de l'assistance", () => {
  const ouverte = { ouverteAssistance: true }
  const fermee = { ouverteAssistance: false }

  it("ne voit que les listes ouvertes à elle", () => {
    expect(listeVisiblePour("assistance", ouverte)).toBe(true)
    expect(listeVisiblePour("assistance", fermee)).toBe(false)
  })

  it("coche et annote tout point d'une liste ouverte, même ceux d'un autre", () => {
    expect(assistancePeut("cocher", ouverte, { creePar: "autre" }, "moi")).toEqual({ autorise: true })
    expect(assistancePeut("annoter", ouverte, { creePar: "autre" }, "moi")).toEqual({ autorise: true })
  })

  it("ne coche rien dans une liste fermée, et dit pourquoi", () => {
    const decision = assistancePeut("cocher", fermee, { creePar: "moi" }, "moi")
    expect(decision).toEqual({ autorise: false, raison: "Cette liste n'est pas ouverte à l'assistance." })
  })

  it("modifie et retire seulement ses propres points", () => {
    expect(assistancePeut("modifier", ouverte, { creePar: "moi" }, "moi")).toEqual({ autorise: true })
    expect(assistancePeut("retirer", ouverte, { creePar: "moi" }, "moi")).toEqual({ autorise: true })
    const refus = assistancePeut("retirer", ouverte, { creePar: "autre" }, "moi")
    expect(refus.autorise).toBe(false)
  })

  it("ajoute un point dans une liste ouverte", () => {
    expect(assistancePeut("ajouter", ouverte, null, "moi")).toEqual({ autorise: true })
    expect(assistancePeut("ajouter", fermee, null, "moi").autorise).toBe(false)
  })

  it("n'accède jamais aux modèles", () => {
    expect(modelesVisiblesPour("assistance")).toBe(false)
    expect(modelesVisiblesPour("invite")).toBe(false)
    expect(modelesVisiblesPour("responsable")).toBe(true)
    expect(modelesVisiblesPour("equipage")).toBe(true)
  })
})

describe("réassignation des points d'un membre retiré", () => {
  it("à faire et en problème sont en attente, fait et sans objet ne le sont pas", () => {
    expect(pointEnAttente("a_faire")).toBe(true)
    expect(pointEnAttente("probleme")).toBe(true)
    expect(pointEnAttente("fait")).toBe(false)
    expect(pointEnAttente("sans_objet")).toBe(false)
  })

  it("une action est proposée seulement si un point est à faire ou en problème", () => {
    expect(doitProposerReassignation([])).toBe(false)
    expect(doitProposerReassignation(["fait", "sans_objet"])).toBe(false)
    expect(doitProposerReassignation(["fait", "a_faire"])).toBe(true)
    expect(doitProposerReassignation(["probleme"])).toBe(true)
  })

  it("l'action est levée quand plus aucun point en attente ne reste", () => {
    expect(reassignationLevee(0)).toBe(true)
    expect(reassignationLevee(1)).toBe(false)
  })
})

describe("phase en cours d'une épreuve (5.6 §1.5)", () => {
  const point = (statut: PointRegle["statut"], critique = false, id = `${statut}-${critique}`) => ({ id, statut, critique })
  const liste = (id: string, phase: ListePhasee["phase"], points: ListePhasee["points"]): ListePhasee => ({ id, phase, points })

  it("aucune liste entamée : avant départ, même si des listes existent déjà dans des phases plus tardives", () => {
    expect(phaseEnCours([])).toBe("avant_depart")
    expect(phaseEnCours([liste("a", "retour", [point("a_faire")])])).toBe("avant_depart")
  })

  it("la phase la plus avancée parmi les listes entamées", () => {
    const listes = [
      liste("a", "avant_depart", [point("fait")]),
      liste("b", "verifications", [point("a_faire")]),
      liste("c", "reconnaissances", [point("sans_objet")]),
    ]
    expect(phaseEnCours(listes)).toBe("reconnaissances")
  })

  it("une liste entamée par un problème compte aussi", () => {
    expect(phaseEnCours([liste("a", "epreuve", [point("probleme")])])).toBe("epreuve")
  })

  it("la première coche d'une liste de phase suivante fait avancer la phase, sans rien mémoriser", () => {
    const avant = [liste("a", "avant_depart", [point("fait")]), liste("b", "verifications", [point("a_faire")])]
    expect(phaseEnCours(avant)).toBe("avant_depart")
    const apres = [liste("a", "avant_depart", [point("fait")]), liste("b", "verifications", [point("fait")])]
    expect(phaseEnCours(apres)).toBe("verifications")
  })
})

describe("avertissement avant une phase (5.6 §1.5)", () => {
  const point = (statut: PointRegle["statut"], critique = false, id = `${statut}-${critique}`) => ({ id, statut, critique })
  const liste = (id: string, phase: ListePhasee["phase"], points: ListePhasee["points"]): ListePhasee => ({ id, phase, points })

  it("ouvrir une liste de phase postérieure avec un critique ouvert avant : avertissement", () => {
    const listes = [
      liste("verif", "verifications", [point("a_faire", true, "critique")]),
      liste("epreuve", "epreuve", [point("a_faire")]),
    ]
    expect(avertissementAvantPhase("epreuve", listes)).toEqual([{ listeId: "verif", pointId: "critique" }])
  })

  it("un critique en problème dans une phase précédente compte aussi", () => {
    const listes = [liste("verif", "verifications", [point("probleme", true, "p")]), liste("epreuve", "epreuve", [point("a_faire")])]
    expect(avertissementAvantPhase("epreuve", listes)).toEqual([{ listeId: "verif", pointId: "p" }])
  })

  it("un critique fait ou sans objet n'avertit pas, ni un point normal ouvert", () => {
    const listes = [
      liste("verif", "verifications", [point("fait", true, "f"), point("sans_objet", true, "s"), point("a_faire", false, "n")]),
      liste("epreuve", "epreuve", [point("a_faire")]),
    ]
    expect(avertissementAvantPhase("epreuve", listes)).toEqual([])
  })

  it("pas d'avertissement pour la phase en cours ou une phase antérieure", () => {
    const listes = [
      liste("avant", "avant_depart", [point("fait")]),
      liste("verif", "verifications", [point("a_faire", true, "c")]),
    ]
    // Phase en cours : verifications (la liste avant départ est entamée). Ouvrir verifications ou avant_depart : rien.
    expect(avertissementAvantPhase("verifications", listes)).toEqual([])
    expect(avertissementAvantPhase("avant_depart", listes)).toEqual([])
  })

  it("seules les phases strictement avant la phase ouverte comptent", () => {
    const listes = [
      liste("retour", "retour", [point("a_faire", true, "tardif")]),
      liste("epreuve", "epreuve", [point("a_faire")]),
    ]
    // Un critique ouvert en « retour » ne concerne pas l'ouverture d'une liste d'« epreuve ».
    expect(avertissementAvantPhase("epreuve", listes)).toEqual([])
  })
})
