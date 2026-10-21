import { describe, expect, it } from "vitest"

import { avancementLivraison, comparerLivraisons, dateDeParis, libelleRetard, receptionPossible } from "./commandes"

describe("barre de livraison", () => {
  it("compte le temps écoulé entre la commande et la date prévue", () => {
    expect(avancementLivraison("2026-10-01", "2026-10-11", "2026-10-01")).toBe(0)
    expect(avancementLivraison("2026-10-01", "2026-10-11", "2026-10-06")).toBe(50)
    expect(avancementLivraison("2026-10-01", "2026-10-11", "2026-10-11")).toBe(100)
  })

  it("reste bornée entre 0 et 100 au-delà de la date prévue", () => {
    expect(avancementLivraison("2026-10-01", "2026-10-11", "2026-10-30")).toBe(100)
    expect(avancementLivraison("2026-10-10", "2026-10-20", "2026-10-01")).toBe(0)
  })

  it("reste vide sans date prévue", () => {
    expect(avancementLivraison("2026-10-01", null, "2026-10-06")).toBe(0)
  })

  it("donne 100 dès le jour même quand la livraison est prévue le jour de la commande", () => {
    expect(avancementLivraison("2026-10-01", "2026-10-01", "2026-10-01")).toBe(100)
  })
})

describe("retard", () => {
  it("dit le retard en mots, au singulier puis au pluriel", () => {
    expect(libelleRetard("2026-10-10", "2026-10-11")).toBe("En retard d'un jour")
    expect(libelleRetard("2026-10-10", "2026-10-15")).toBe("En retard de 5 jours")
  })

  it("ne dit rien tant que la date n'est pas passée, ni sans date prévue", () => {
    expect(libelleRetard("2026-10-10", "2026-10-10")).toBeNull()
    expect(libelleRetard("2026-10-20", "2026-10-10")).toBeNull()
    expect(libelleRetard(null, "2026-10-10")).toBeNull()
  })

  it("passe le mois sans erreur (31 octobre, puis 1er novembre)", () => {
    expect(libelleRetard("2026-10-31", "2026-11-02")).toBe("En retard de 2 jours")
  })
})

describe("tri des livraisons", () => {
  it("trie par date prévue croissante, sans date en dernier", () => {
    const dates: Array<string | null> = ["2026-11-02", null, "2026-10-20"]
    expect(dates.sort(comparerLivraisons)).toEqual(["2026-10-20", "2026-11-02", null])
  })
})

describe("date de Paris", () => {
  it("donne le jour de Paris, pas celui de UTC, juste avant minuit", () => {
    // 22 h 30 UTC le 31 octobre 2026 : minuit approche à Paris, déjà le 31 (UTC+1 en hiver).
    expect(dateDeParis(new Date("2026-10-31T22:30:00Z"))).toBe("2026-10-31")
    // 23 h 30 UTC le 31 octobre : 0 h 30 à Paris, le 1er novembre.
    expect(dateDeParis(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01")
  })
})

describe("réception", () => {
  it("n'est possible qu'une fois : une commande reçue ne se reçoit plus", () => {
    expect(receptionPossible("commandee")).toBe(true)
    expect(receptionPossible("expediee")).toBe(true)
    expect(receptionPossible("recue")).toBe(false)
  })
})
