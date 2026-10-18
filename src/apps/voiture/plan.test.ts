import { describe, expect, it } from "vitest"

import { gabaritSaxo } from "./gabarits/saxo"
import {
  COTE_MINIMAL,
  bornesDu,
  comptesDeStatuts,
  deplacerForme,
  emplacementsDeLaListe,
  emplacementsDessines,
  etendueDe,
  formeAffichee,
  formeAuCentre,
  formeDeJson,
  formeDuChamp,
  libelleComptes,
  miroirDeForme,
  redimensionnerForme,
} from "./plan"

const bornes = bornesDu(gabaritSaxo.viewBox)

describe("plan de déco : géométrie", () => {
  it("lit le viewBox du gabarit Saxo", () => {
    expect(bornes).toEqual({ x: 0, y: -14, l: 370, h: 173 })
  })

  it("miroir : un rectangle symétrique change de côté dans la même boîte, sans bouger en hauteur", () => {
    const portiere = { type: "rect" as const, x: 150.7, y: 61.2, l: 87.1, h: 17.4 }
    const miroir = miroirDeForme(portiere, bornes)
    expect(miroir).toEqual({ type: "rect", x: 370 - 150.7 - 87.1, y: 61.2, l: 87.1, h: 17.4 })
    // Deux miroirs successifs redonnent la forme d'origine.
    expect(etendueDe(miroirDeForme(miroir, bornes)).x).toBeCloseTo(150.7)
  })

  it("miroir d'un polygone : chaque point est retourné", () => {
    const miroir = miroirDeForme({ type: "polygone", points: [[10, 1], [20, 2]] }, bornes)
    expect(miroir).toEqual({ type: "polygone", points: [[360, 1], [350, 2]] })
  })

  it("côté gauche : seuls les emplacements symétriques de la vue droite sont dessinés (5 sur 6 pour la Saxo)", () => {
    const emplacements = gabaritSaxo.emplacementsTypes.map((t, i) => ({ id: String(i), ...t, vue: t.vue }))
    expect(emplacementsDessines(emplacements, "droite")).toHaveLength(6)
    const gauche = emplacementsDessines(emplacements, "gauche")
    expect(gauche).toHaveLength(5)
    expect(gauche.map((e) => e.nom)).not.toContain("Bandeau de pare-brise")
  })

  it("la liste garde les hors plan, sous « Autres emplacements », dans les deux côtés", () => {
    const emplacements = gabaritSaxo.emplacementsTypes.map((t, i) => ({ id: String(i), ...t }))
    expect(emplacementsDeLaListe(emplacements, "droite").plan).toHaveLength(6)
    expect(emplacementsDeLaListe(emplacements, "droite").horsPlan).toHaveLength(4)
    expect(emplacementsDeLaListe(emplacements, "gauche").horsPlan).toHaveLength(4)
  })

  it("forme affichée : la vue gauche prend le miroir, la vue droite non", () => {
    const forme = { type: "rect" as const, x: 29.6, y: 78, l: 23, h: 13.5 }
    expect(formeAffichee(forme, "droite", bornes)).toBe(forme)
    expect(etendueDe(formeAffichee(forme, "gauche", bornes)).x).toBeCloseTo(370 - 29.6 - 23)
  })

  it("nouvel emplacement : 60 × 20 unités, centré sur le viewBox", () => {
    expect(formeAuCentre(bornes)).toEqual({ type: "rect", x: 155, y: 62.5, l: 60, h: 20 })
  })

  it("déplacement : décalage appliqué, puis borné au viewBox", () => {
    const forme = { type: "rect" as const, x: 30, y: 78, l: 23, h: 13 }
    expect(deplacerForme(forme, 10, 0, bornes)).toMatchObject({ x: 40, y: 78 })
    expect(deplacerForme(forme, -500, 500, bornes)).toMatchObject({ x: 0, y: 159 - 13 })
  })

  it("déplacement d'un polygone : le bloc entier bouge, il n'est pas déformé", () => {
    const forme = { type: "polygone" as const, points: [[200, 20], [230, 30]] as Array<[number, number]> }
    const deplace = deplacerForme(forme, 5, 2, bornes)
    expect(deplace).toEqual({ type: "polygone", points: [[205, 22], [235, 32]] })
  })

  it("redimensionnement : minimum de 8 unités, pas de sortie du viewBox, polygone inchangé", () => {
    const forme = { type: "rect" as const, x: 30, y: 78, l: 23, h: 13 }
    expect(redimensionnerForme(forme, 2, 2, bornes)).toMatchObject({ l: COTE_MINIMAL, h: COTE_MINIMAL })
    expect(redimensionnerForme(forme, 1000, 1000, bornes)).toMatchObject({ l: 370 - 30, h: 159 - 78 })
    const polygone = { type: "polygone" as const, points: [[1, 1], [2, 2]] as Array<[number, number]> }
    expect(redimensionnerForme(polygone, 100, 100, bornes)).toBe(polygone)
  })

  it("champs X, Y, Largeur, Hauteur : la valeur saisie est bornée", () => {
    const forme = { type: "rect" as const, x: 30, y: 78, l: 23, h: 13 }
    expect(formeDuChamp(forme, "x", 40, bornes)).toMatchObject({ x: 40, y: 78 })
    expect(formeDuChamp(forme, "y", 9999, bornes)).toMatchObject({ y: 159 - 13 })
    expect(formeDuChamp(forme, "l", 3, bornes)).toMatchObject({ l: COTE_MINIMAL })
    expect(etendueDe(formeDuChamp(forme, "h", 40, bornes))).toMatchObject({ h: 40 })
  })

  it("lit une forme stockée en JSON, et refuse le reste", () => {
    expect(formeDeJson({ type: "rect", x: 1, y: 2, l: 3, h: 4 })).toEqual({ type: "rect", x: 1, y: 2, l: 3, h: 4 })
    expect(formeDeJson({ type: "polygone", points: [[1, 2]] })).toEqual({ type: "polygone", points: [[1, 2]] })
    expect(formeDeJson({ type: "rect", x: "1" })).toBeNull()
    expect(formeDeJson(null)).toBeNull()
  })
})

describe("plan de déco : légende", () => {
  it("compte les quatre statuts et écrit le pluriel", () => {
    const comptes = comptesDeStatuts(["libre", "libre", "libre", "reserve", "occupe"])
    expect(comptes).toEqual({ libre: 3, reserve: 1, occupe: 1, indisponible: 0 })
    expect(libelleComptes(comptes)).toBe("3 libres · 1 réservé · 1 occupé · 0 indisponibles")
  })

  it("au singulier pour un seul", () => {
    expect(libelleComptes(comptesDeStatuts(["indisponible"]))).toBe("0 libres · 0 réservés · 0 occupés · 1 indisponible")
  })
})
