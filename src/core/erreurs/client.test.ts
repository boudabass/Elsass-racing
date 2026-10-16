import { describe, expect, it } from "vitest"

import { ajouterEnAttente, LIMITE_EN_ATTENTE, LIMITE_MESSAGE, LIMITE_PILE, preparerErreur, type ErreurClient } from "./client"

const contexte = { page: "/qg", version: "v1", navigateur: "Chrome", enLigne: false, date: "2026-10-16T10:00:00.000Z" }

describe("préparation d'une erreur", () => {
  it("tronque la pile et le message", () => {
    const erreur = preparerErreur({ message: "x".repeat(900), stack: "y".repeat(5000) }, contexte)
    expect(erreur.message).toHaveLength(LIMITE_MESSAGE)
    expect(erreur.pile).toHaveLength(LIMITE_PILE)
  })

  it("garde la page et l'état du réseau, sans autre donnée", () => {
    const erreur = preparerErreur({ message: "Échec", stack: "pile" }, contexte)
    expect(erreur).toEqual({
      message: "Échec",
      pile: "pile",
      page: "/qg",
      version: "v1",
      navigateur: "Chrome",
      enLigne: false,
      date: "2026-10-16T10:00:00.000Z",
    })
  })

  it("donne un message de repli sans texte d'erreur", () => {
    expect(preparerErreur({}, contexte).message).toBe("Erreur inconnue")
  })
})

describe("erreurs gardées hors ligne", () => {
  const erreur = (n: number): ErreurClient => preparerErreur({ message: `n${n}` }, contexte)

  it("ajoute sans dépasser la limite, et garde les plus récentes", () => {
    let liste: ErreurClient[] = []
    for (let n = 0; n < LIMITE_EN_ATTENTE + 5; n++) liste = ajouterEnAttente(liste, erreur(n))
    expect(liste).toHaveLength(LIMITE_EN_ATTENTE)
    expect(liste[liste.length - 1].message).toBe(`n${LIMITE_EN_ATTENTE + 4}`)
    expect(liste[0].message).toBe("n5")
  })
})
