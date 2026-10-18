import { describe, expect, it } from "vitest"

import { blocsDuTexte } from "./document"
import { MODELE_DEFAUT_V1 } from "./modele-defaut"
import { formaterMontant, remplirModele } from "./regles"

describe("mise en blocs du texte d'une convention", () => {
  it("titre, articles en intertitres, paragraphes, puces et signature", () => {
    const blocs = blocsDuTexte(
      ["CONVENTION DE PARTENARIAT", "Saison 2027", "", "Article 1 : Objet", "", "Le partenaire soutient la team.", "", "Article 2 : Apport", "", "Le partenaire apporte :", "- un apport financier ;", "- un apport en nature.", "", "Fait à ________.", "", "Pour la team : Jo Koehling", "Signature", "Pour le partenaire : Ana Verif"].join("\n"),
    )
    expect(blocs).toEqual([
      { type: "titre", texte: "CONVENTION DE PARTENARIAT" },
      { type: "paragraphe", texte: "Saison 2027" },
      { type: "intertitre", texte: "Article 1 : Objet" },
      { type: "paragraphe", texte: "Le partenaire soutient la team." },
      { type: "intertitre", texte: "Article 2 : Apport" },
      { type: "paragraphe", texte: "Le partenaire apporte :" },
      { type: "puces", elements: ["un apport financier ;", "un apport en nature."] },
      { type: "paragraphe", texte: "Fait à ________." },
      { type: "signature", team: "Jo Koehling", partenaire: "Ana Verif" },
    ])
  })

  it("un modèle par défaut rempli donne onze articles et une signature à la fin", () => {
    const texte = remplirModele(MODELE_DEFAUT_V1.texte, {
      "team.nom": "Koehling Racing Team",
      "partenaire.entreprise": "Garage Muller",
      contreparties: [{ libelle: "Logo sur la voiture", quantite: 1, unite: "emplacement", emplacement: "Portière", epreuves: [], echeance: null }],
    }).texte
    const blocs = blocsDuTexte(texte)
    expect(blocs.filter((b) => b.type === "intertitre")).toHaveLength(11)
    expect(blocs.some((b) => b.type === "puces" && b.elements[0].startsWith("Logo sur la voiture"))).toBe(true)
    expect(blocs[blocs.length - 1].type).toBe("signature")
  })

  it("le montant en lettres d'un apport de 1 500 € figure dans le texte de la convention", () => {
    const { texte } = remplirModele(MODELE_DEFAUT_V1.texte, { "convention.apport_financier": formaterMontant(150000) })
    expect(texte).toContain("mille cinq cents euros")
  })
})
