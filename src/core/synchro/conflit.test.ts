import { describe, expect, it } from "vitest"

import { decideModification, decideSuppression } from "./conflit"

describe("décision de modification", () => {
  it("applique quand la rev lue est la rev serveur", () => {
    expect(decideModification({ revLue: 3, revServeur: 3, supprimee: false })).toBe("appliquer")
  })

  it("applique et journalise quand la ligne a changé entre-temps", () => {
    expect(decideModification({ revLue: 3, revServeur: 4, supprimee: false })).toBe("appliquer_et_journaliser")
  })

  it("laisse la suppression gagner sur une modification concurrente", () => {
    expect(decideModification({ revLue: 3, revServeur: 4, supprimee: true })).toBe("supprimee_gagne")
  })
})

describe("décision de suppression", () => {
  it("ne fait rien si la ligne est déjà supprimée", () => {
    expect(decideSuppression({ revLue: 3, revServeur: 4, supprimee: true })).toBe("deja_supprimee")
  })

  it("supprime sans journal si la rev est la même", () => {
    expect(decideSuppression({ revLue: 3, revServeur: 3, supprimee: false })).toBe("supprimer")
  })

  it("supprime et journalise si la ligne a changé", () => {
    expect(decideSuppression({ revLue: 2, revServeur: 3, supprimee: false })).toBe("supprimer_et_journaliser")
  })
})
