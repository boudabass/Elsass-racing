import { describe, expect, it } from "vitest"

import { peutEcrire, perimetreLecture } from "./contribution"

describe("périmètre de lecture", () => {
  it("n'ouvre rien sans le niveau de lecture requis", () => {
    expect(perimetreLecture("aucun", "lecture")).toBe("aucun")
  })

  it("au niveau contribution, ne donne que ses propres lignes", () => {
    expect(perimetreLecture("contribution", "lecture")).toBe("ses_lignes")
  })

  it("à partir de la lecture, donne toute la team", () => {
    expect(perimetreLecture("lecture", "lecture")).toBe("toute_la_team")
    expect(perimetreLecture("ecriture", "lecture")).toBe("toute_la_team")
    expect(perimetreLecture("gestion", "lecture")).toBe("toute_la_team")
  })
})

const moi = "11111111-1111-4111-8111-111111111111"
const autre = "22222222-2222-4222-8222-222222222222"

describe("règle de contribution", () => {
  it("refuse toute écriture sans le niveau contribution", () => {
    expect(peutEcrire({ niveau: "lecture", contributionPropre: true, auteurId: moi, userId: moi, creation: false }).ok).toBe(false)
  })

  it("permet la création au niveau contribution", () => {
    expect(peutEcrire({ niveau: "contribution", contributionPropre: true, auteurId: null, userId: moi, creation: true })).toEqual({ ok: true })
  })

  it("au niveau contribution, n'écrit que ses propres lignes", () => {
    expect(peutEcrire({ niveau: "contribution", contributionPropre: true, auteurId: moi, userId: moi, creation: false })).toEqual({ ok: true })
    expect(peutEcrire({ niveau: "contribution", contributionPropre: true, auteurId: autre, userId: moi, creation: false }).ok).toBe(false)
  })

  it("au niveau écriture, écrit les lignes des autres", () => {
    expect(peutEcrire({ niveau: "ecriture", contributionPropre: true, auteurId: autre, userId: moi, creation: false })).toEqual({ ok: true })
  })

  it("sans règle propre, n'impose pas l'auteur", () => {
    expect(peutEcrire({ niveau: "contribution", contributionPropre: false, auteurId: autre, userId: moi, creation: false })).toEqual({ ok: true })
  })
})

describe("règle de contribution par affectation", () => {
  it("au niveau contribution, n'écrit que les lignes qui lui sont affectées, même si un autre les a créées", () => {
    expect(peutEcrire({ niveau: "contribution", contributionPropre: true, regle: "affectation", affecte: true, auteurId: autre, userId: moi, creation: false })).toEqual({ ok: true })
    const refus = peutEcrire({ niveau: "contribution", contributionPropre: true, regle: "affectation", affecte: false, auteurId: moi, userId: moi, creation: false })
    expect(refus).toEqual({ ok: false, raison: "Tu ne peux modifier que les éléments qui te sont affectés." })
  })

  it("sans indication d'affectation, refuse : le défaut est non affecté", () => {
    expect(peutEcrire({ niveau: "contribution", contributionPropre: true, regle: "affectation", auteurId: moi, userId: moi, creation: false }).ok).toBe(false)
  })

  it("garde la création libre au niveau contribution, l'auteur devient le membre", () => {
    expect(peutEcrire({ niveau: "contribution", contributionPropre: true, regle: "affectation", affecte: false, auteurId: null, userId: moi, creation: true })).toEqual({ ok: true })
  })

  it("au niveau écriture, n'impose pas l'affectation", () => {
    expect(peutEcrire({ niveau: "ecriture", contributionPropre: true, regle: "affectation", affecte: false, auteurId: autre, userId: moi, creation: false })).toEqual({ ok: true })
  })

  it("la règle par défaut reste celle de l'auteur, affectation ignorée", () => {
    expect(peutEcrire({ niveau: "contribution", contributionPropre: true, regle: "createur", affecte: true, auteurId: autre, userId: moi, creation: false }).ok).toBe(false)
  })
})
