import { describe, expect, it } from "vitest"

import { EMPLACEMENTS_PAR_TYPE } from "./emplacements"
import {
  CADRE_DESSUS,
  decalageTexteRepere,
  largeurRepereA,
  pointPourEmplacement,
  RAYON_CONTACT_TELEPHONE,
  versCadreDessus,
} from "./positions"

const emplacements = (gabarit: string) =>
  Object.entries(EMPLACEMENTS_PAR_TYPE).flatMap(([cle, liste]) =>
    liste.map((emplacement) => ({
      cle,
      position: emplacement.position,
      point: pointPourEmplacement(gabarit, { cle, position: emplacement.position }),
    })),
  )

describe("repères de la vue de dessus (emplacements)", () => {
  it("chaque emplacement a un repère sur la Saxo et sur le générique", () => {
    for (const gabarit of ["citadine_3p_saxo", "voiture_generique"]) {
      for (const { cle, position, point } of emplacements(gabarit)) {
        expect(point, `${gabarit} : ${cle} ${position}`).not.toBeNull()
      }
    }
  })

  // Le cadre : tout le cercle de contact tient dans la vue, téléphone compris.
  it("chaque repère, avec son cercle de contact à la taille téléphone, reste dans le cadre", () => {
    const [largeur, hauteur] = CADRE_DESSUS.viewBox.split(" ").slice(2).map(Number)
    for (const gabarit of ["citadine_3p_saxo", "voiture_generique"]) {
      for (const { cle, position, point } of emplacements(gabarit)) {
        expect(point!.x, `${gabarit} ${cle} ${position}`).toBeGreaterThanOrEqual(RAYON_CONTACT_TELEPHONE)
        expect(point!.x, `${gabarit} ${cle} ${position}`).toBeLessThanOrEqual(largeur - RAYON_CONTACT_TELEPHONE)
        expect(point!.y, `${gabarit} ${cle} ${position}`).toBeGreaterThanOrEqual(RAYON_CONTACT_TELEPHONE)
        expect(point!.y, `${gabarit} ${cle} ${position}`).toBeLessThanOrEqual(hauteur - RAYON_CONTACT_TELEPHONE)
      }
    }
  })

  // Nez vers le haut : l'avant est en haut du cadre, l'arrière en bas. Le côté gauche de la voiture est à gauche de l'écran.
  it("nez vers le haut : les organes avant sont au-dessus des arrière, le moteur en tête", () => {
    const avant = pointPourEmplacement("citadine_3p_saxo", { cle: "freins", position: "avant_gauche" })!
    const arriere = pointPourEmplacement("citadine_3p_saxo", { cle: "freins", position: "arriere_gauche" })!
    expect(avant.y).toBeLessThan(arriere.y)
    const moteur = pointPourEmplacement("citadine_3p_saxo", { cle: "moteur", position: "unique" })!
    const pneus = pointPourEmplacement("citadine_3p_saxo", { cle: "pneus", position: "train" })!
    expect(moteur.y).toBeLessThan(pneus.y)
  })

  it("le côté gauche de la voiture est à gauche de l'écran", () => {
    for (const cle of ["freins", "amortisseurs"]) {
      const gauche = pointPourEmplacement("citadine_3p_saxo", { cle, position: "avant_gauche" })!
      const droite = pointPourEmplacement("citadine_3p_saxo", { cle, position: "avant_droit" })!
      expect(gauche.x, cle).toBeLessThan(droite.x)
    }
    const gaucheT = pointPourEmplacement("citadine_3p_saxo", { cle: "transmissions", position: "gauche" })!
    const droiteT = pointPourEmplacement("citadine_3p_saxo", { cle: "transmissions", position: "droite" })!
    expect(gaucheT.x).toBeLessThan(droiteT.x)
  })

  // Le dessin tourné et les repères suivent la même transformation : le nez du dessin (x 370) tombe en haut, au centre.
  it("la transformation du dessin et les repères donnent le même cadre", () => {
    expect(CADRE_DESSUS.transformation).toBe("matrix(0 -1 1 0 14 370)")
    expect(versCadreDessus({ x: 370, y: 75 })).toEqual({ x: 89, y: 0 })
    expect(versCadreDessus({ x: 0, y: -14 })).toEqual({ x: 0, y: 370 })
  })

  // Les contacts de la vue de dessus ne se coupent pas, pour la Saxo et le générique, à la taille téléphone.
  it("à la taille téléphone, deux repères de la vue de dessus ne se coupent pas, sur la Saxo et le générique", () => {
    for (const gabarit of ["citadine_3p_saxo", "voiture_generique"]) {
      const points = emplacements(gabarit)
      expect(points).toHaveLength(14)
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const distance = Math.hypot(points[i].point!.x - points[j].point!.x, points[i].point!.y - points[j].point!.y)
          expect(distance, `${gabarit} : ${points[i].cle} ${points[i].position} et ${points[j].cle} ${points[j].position}`).toBeGreaterThan(
            2 * RAYON_CONTACT_TELEPHONE,
          )
        }
      }
    }
  })

  it("sans gabarit, sans position ou pour un type de la team, pas de repère", () => {
    expect(pointPourEmplacement(null, { cle: "moteur", position: "unique" })).toBeNull()
    expect(pointPourEmplacement("citadine_3p_saxo", { cle: "moteur", position: null })).toBeNull()
    expect(pointPourEmplacement("citadine_3p_saxo", { cle: null, position: "unique" })).toBeNull()
    expect(pointPourEmplacement("citadine_3p_saxo", { cle: "freins", position: "inconnue" })).toBeNull()
  })
})

// Le pourcentage tient dans le triangle orange (zone de 10 à 30 %, donc trois caractères au plus), aux deux tailles.
describe("texte du repère dans sa forme", () => {
  const CARACTERE = 0.6 // largeur moyenne d'un caractère, en fraction de la taille de police

  it("le triangle orange descend le texte à son centre de gravité, les autres formes le gardent au centre", () => {
    expect(decalageTexteRepere("orange", 12)).toBeGreaterThan(0)
    expect(decalageTexteRepere("vert", 12)).toBe(0)
    expect(decalageTexteRepere("rouge", 12)).toBe(0)
    expect(decalageTexteRepere("a_renseigner", 12)).toBe(0)
  })

  it("à la taille du bureau et du téléphone, « 30% » tient dans le triangle orange, bord du haut du texte compris", () => {
    for (const { rayon, taille } of [
      { rayon: 12, taille: 8 },
      { rayon: 16, taille: 7 },
    ]) {
      const dy = decalageTexteRepere("orange", rayon)
      const haut = dy - 0.36 * taille
      const largeurTexte = 3 * CARACTERE * taille
      expect(largeurRepereA("orange", rayon, haut), `rayon ${rayon}`).toBeGreaterThanOrEqual(largeurTexte)
    }
  })

  it("le losange et le rond ont au moins la largeur du texte au centre", () => {
    for (const zone of ["rouge", "vert"] as const) {
      expect(largeurRepereA(zone, 12, 0), zone).toBeGreaterThanOrEqual(3 * CARACTERE * 8)
    }
  })
})
