import { describe, expect, it } from "vitest"

import { indicePourEngagement, lieuDeReglage, pointsDePreparation } from "./preparation"

const midi = new Date("2026-10-16T10:00:00Z")
const dans = (jours: number) => new Date(midi.getTime() + jours * 24 * 60 * 60 * 1000)

describe("pointsDePreparation", () => {
  it("le paiement existe toujours : réglé ou ouvert selon l'inscription", () => {
    expect(pointsDePreparation(true, []).find((p) => p.point === "paiement")).toMatchObject({ etat: "regle", detail: null })
    expect(pointsDePreparation(false, []).find((p) => p.point === "paiement")).toMatchObject({ etat: "ouvert", detail: "Engagement non payé" })
  })

  it("un point sans ligne est « pas encore suivi », pas réglé", () => {
    const points = pointsDePreparation(true, [])
    expect(points.filter((p) => p.etat === "non_suivi").map((p) => p.point)).toEqual(["licences", "homologations", "papiers", "pieces"])
  })

  it("reprend l'état et le détail de la ligne saison_readiness", () => {
    const points = pointsDePreparation(true, [{ point: "licences", statut: "ouvert", detail: "Licence de Luc expire le 3 novembre" }])
    expect(points.find((p) => p.point === "licences")).toEqual({ point: "licences", etat: "ouvert", detail: "Licence de Luc expire le 3 novembre" })
  })
})

describe("indicePourEngagement", () => {
  it("ne compte que les points suivis : un point pas encore suivi ne fait pas baisser l'indice", () => {
    const points = pointsDePreparation(true, [])
    expect(indicePourEngagement(points, midi, dans(30))).toEqual({ pourcentage: 100, couleur: "vert" })
  })

  it("100 n'apparaît que si chaque point suivi est réglé", () => {
    const points = pointsDePreparation(true, [{ point: "papiers", statut: "ouvert", detail: null }])
    expect(indicePourEngagement(points, midi, dans(30))).toEqual({ pourcentage: 50, couleur: "orange" })
  })

  it("rouge quand un point ouvert commence dans moins de 48 heures", () => {
    const points = pointsDePreparation(false, [])
    expect(indicePourEngagement(points, midi, dans(1))?.couleur).toBe("rouge")
    expect(indicePourEngagement(points, midi, dans(10))?.couleur).toBe("orange")
  })

  it("pas d'indice quand aucun point n'est suivi", () => {
    expect(indicePourEngagement([], midi, dans(1))).toBeNull()
  })
})

describe("lieuDeReglage", () => {
  it("le paiement se règle sur la fiche engagement ; les autres nulle part pour l'instant", () => {
    expect(lieuDeReglage("paiement")).toBe("fiche_engagement")
    expect(lieuDeReglage("licences")).toBeNull()
  })
})
