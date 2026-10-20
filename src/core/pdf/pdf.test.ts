import { createElement } from "react"
import { describe, expect, it } from "vitest"

import { ChiffresCles, Paragraphe, Tableau } from "./composants"
import { DocumentTeam } from "./document-team"
import { rendrePdf } from "./rendu-serveur"
import { textePdf } from "./texte"

describe("textePdf", () => {
  it("remplace les espaces insécables (U+00A0 et U+202F) par une espace ordinaire", () => {
    expect(textePdf("1 234,50 €")).toBe("1 234,50 €")
  })

  it("laisse le reste du texte intact, accents et tirets compris", () => {
    expect(textePdf("Péages – été")).toBe("Péages – été")
  })
})

describe("rendrePdf", () => {
  it("produit un PDF avec son en-tête %PDF-, sans logo", async () => {
    const document = createElement(
      DocumentTeam,
      {
        titre: "Document d'essai",
        sousTitre: "Arrêté au 18 octobre 2026",
        team: { nom: "Équipe d'essai", couleur: null, logo: null },
      },
      createElement(ChiffresCles, { chiffres: [{ libelle: "Dépenses", valeur: "1 234,50 €" }] }),
      createElement(Paragraphe, null, "Aucun mouvement enregistré pour cette saison."),
      createElement(Tableau, {
        colonnes: [
          { titre: "Catégorie", largeur: 3 },
          { titre: "Montant", largeur: 1, alignDroite: true },
        ],
        lignes: [
          ["Péages", "18,40 €"],
          ["Pneus", "120,00 €"],
        ],
        total: ["Total", "138,40 €"],
      }),
    )
    const octets = await rendrePdf(document)
    expect(octets.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  })
})
