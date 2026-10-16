import { describe, expect, it } from "vitest"

import { peutEcrire } from "./contribution"

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
