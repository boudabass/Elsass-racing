import { describe, expect, it } from "vitest"

import { construireBilan, type EntreesBilan, type PreuveBilan } from "./bilan"

const preuve = (surcharge: Partial<PreuveBilan>): PreuveBilan => ({
  id: "p",
  date: "2026-06-10",
  type: "Photo",
  epreuve: "Rallye de test",
  visiblePartenaire: true,
  estImage: true,
  fileId: "f",
  lien: null,
  commentaire: null,
  ...surcharge,
})

const entrees = (surcharge: Partial<EntreesBilan> = {}): EntreesBilan => ({
  debut: "2026-06-01",
  fin: "2026-06-30",
  contreparties: [{ libelle: "Logo sur la voiture", quantitePromise: 1, quantiteTenue: 1, statut: "tenue", echeance: null }],
  preuves: [],
  resultats: [],
  epreuvesCourues: 2,
  ...surcharge,
})

describe("construireBilan", () => {
  it("n'écrit jamais une preuve masquée, même si elle est passée en entrée", () => {
    const bilan = construireBilan(
      entrees({
        preuves: [preuve({ id: "visible" }), preuve({ id: "masquee", visiblePartenaire: false, fileId: "secret" })],
      }),
    )
    expect(bilan.preuves.map((p) => p.id)).toEqual(["visible"])
    expect(bilan.chiffres.preuves).toBe(1)
    expect(JSON.stringify(bilan)).not.toContain("secret")
  })

  it("laisse de côté une preuve et un résultat hors de la période", () => {
    const bilan = construireBilan(
      entrees({
        preuves: [preuve({ id: "avant", date: "2026-05-31" }), preuve({ id: "dedans", date: "2026-06-30" }), preuve({ id: "apres", date: "2026-07-01" })],
        resultats: [
          { epreuve: "Hors période", date: "2026-05-02", statut: "Arrivée", classementGeneral: 3, nbClasses: 20, classementClasse: null, nbPartantsClasse: null },
        ],
      }),
    )
    expect(bilan.preuves.map((p) => p.id)).toEqual(["dedans"])
    expect(bilan.resultats).toEqual([])
  })

  it("trie les preuves de la plus ancienne à la plus récente", () => {
    const bilan = construireBilan(entrees({ preuves: [preuve({ id: "b", date: "2026-06-20" }), preuve({ id: "a", date: "2026-06-02" })] }))
    expect(bilan.preuves.map((p) => p.id)).toEqual(["a", "b"])
  })

  it("compte les contreparties tenues sur le total, et les épreuves courues", () => {
    const bilan = construireBilan(
      entrees({
        contreparties: [
          { libelle: "A", quantitePromise: 1, quantiteTenue: 1, statut: "tenue", echeance: null },
          { libelle: "B", quantitePromise: 4, quantiteTenue: 1, statut: "en_cours", echeance: "2026-12-31" },
        ],
      }),
    )
    expect(bilan.chiffres).toEqual({ contrepartiesTenues: 1, contrepartiesTotal: 2, preuves: 0, epreuvesCourues: 2 })
  })
})
