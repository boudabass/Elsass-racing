import { describe, expect, it } from "vitest"

import { resteAFaire } from "./reste-a-faire"

describe("resteAFaire", () => {
  it("une épreuve annulée n'a plus rien à faire", () => {
    expect(resteAFaire({ statut: "annulee", engagements: [{ statut: "inscrit", resultat: null }] })).toBeNull()
  })

  it("sans engagement, il faut engager une voiture", () => {
    expect(resteAFaire({ statut: "envisagee", engagements: [] })).toBe("Engager une voiture")
  })

  it("un engagement inscrit ou envisagé, avant l'épreuve, est à payer", () => {
    expect(resteAFaire({ statut: "envisagee", engagements: [{ statut: "inscrit", resultat: null }] })).toBe("Engagement à payer")
    expect(resteAFaire({ statut: "envisagee", engagements: [{ statut: "envisage", resultat: null }] })).toBe("Engagement à payer")
  })

  it("un engagement payé, avant l'épreuve, n'a rien à faire", () => {
    expect(resteAFaire({ statut: "envisagee", engagements: [{ statut: "paye", resultat: null }] })).toBeNull()
  })

  it("une épreuve en cours avec un engagement parti sans résultat : résultat à saisir", () => {
    expect(resteAFaire({ statut: "en_cours", engagements: [{ statut: "parti", resultat: null }] })).toBe("Résultat à saisir")
  })

  it("une épreuve terminée avec un résultat saisi ou à vérifier : résultat à valider", () => {
    expect(resteAFaire({ statut: "terminee", engagements: [{ statut: "arrivee", resultat: "saisi" }] })).toBe("Résultat à valider")
    expect(resteAFaire({ statut: "terminee", engagements: [{ statut: "arrivee", resultat: "a_verifier" }] })).toBe("Résultat à valider")
  })

  it("une épreuve terminée avec tous les résultats validés n'a rien à faire", () => {
    expect(resteAFaire({ statut: "terminee", engagements: [{ statut: "arrivee", resultat: "valide" }] })).toBeNull()
  })

  it("le résultat à saisir prime sur le paiement, une fois l'épreuve commencée", () => {
    expect(
      resteAFaire({
        statut: "en_cours",
        engagements: [
          { statut: "parti", resultat: null },
          { statut: "inscrit", resultat: null },
        ],
      }),
    ).toBe("Résultat à saisir")
  })
})
