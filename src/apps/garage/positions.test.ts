import { describe, expect, it } from "vitest"

import { EMPLACEMENTS_PAR_TYPE } from "./emplacements"
import { CADRE_DESSUS, pointPourEmplacement, pointPourOrgane, pointValide, RAYON_CONTACT_TELEPHONE, versCadreDessus } from "./positions"
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
    expect(pointPourOrgane("citadine_3p_saxo", { cle: "moteur", positions: invalide })).toEqual({ x: 306, y: 66 })
  })

  // À la taille téléphone (le plus gros des deux rayons de contact), deux cercles de contact ne se coupent pas.
  it("à la taille du repère, les cercles de contact ne se coupent pas, pour la Saxo et la voiture générique", () => {
    for (const gabarit of ["citadine_3p_saxo", "voiture_generique"]) {
      const points = TYPES_DEFAUT.map((type) => pointPourOrgane(gabarit, { cle: type.cle, positions: null }))
      expect(points.every((point) => point !== null)).toBe(true)
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const distance = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y)
          expect(distance, `${gabarit} : ${TYPES_DEFAUT[i].cle} et ${TYPES_DEFAUT[j].cle}`).toBeGreaterThan(2 * RAYON_CONTACT_TELEPHONE)
        }
      }
    }
  })
})

describe("repères de la vue de dessus (emplacements)", () => {
  const emplacements = (gabarit: string) =>
    Object.entries(EMPLACEMENTS_PAR_TYPE).flatMap(([cle, liste]) =>
      liste.map((emplacement) => ({
        cle,
        position: emplacement.position,
        point: pointPourEmplacement(gabarit, { cle, position: emplacement.position }),
      })),
    )

  it("chaque emplacement a un repère sur la Saxo et sur le générique", () => {
    for (const gabarit of ["citadine_3p_saxo", "voiture_generique"]) {
      for (const { cle, position, point } of emplacements(gabarit)) {
        expect(point, `${gabarit} : ${cle} ${position}`).not.toBeNull()
      }
    }
  })

  it("chaque repère reste dans le cadre de la vue de dessus, sur la Saxo et le générique", () => {
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
