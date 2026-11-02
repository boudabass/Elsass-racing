import { describe, expect, it } from "vitest"

import {
  engagementsSansListeRetour,
  estDoublon,
  pointCochable,
  pointDejaLie,
  titrePointPropose,
  titreRelireReglement,
} from "./propositions-regles"

describe("cocher un point", () => {
  it("un point à faire ou en problème se coche", () => {
    expect(pointCochable("a_faire")).toBe(true)
    expect(pointCochable("probleme")).toBe(true)
  })

  it("un point déjà fait ou sans objet ne se recoche pas", () => {
    expect(pointCochable("fait")).toBe(false)
    expect(pointCochable("sans_objet")).toBe(false)
  })
})

describe("doublon", () => {
  const ajout = { type: "ajouter_point" as const, cle: "organe:1", listeId: "liste-a" }

  it("une proposition du même type, objet et liste bloque la suivante, quel que soit son statut", () => {
    expect(estDoublon([ajout], ajout)).toBe(true)
  })

  it("une autre liste, un autre objet ou un autre type ne bloquent pas", () => {
    expect(estDoublon([ajout], { ...ajout, listeId: "liste-b" })).toBe(false)
    expect(estDoublon([ajout], { ...ajout, cle: "organe:2" })).toBe(false)
    expect(estDoublon([ajout], { ...ajout, type: "cocher_point" })).toBe(false)
  })

  it("une liste absente (règlement, une seule proposition par règlement) compare null à null", () => {
    const reglement = { type: "relire_liste" as const, cle: "reglement:9", listeId: null }
    expect(estDoublon([reglement], reglement)).toBe(true)
    expect(estDoublon([reglement], { ...reglement, cle: "reglement:10" })).toBe(false)
  })
})

describe("liste de retour (cible)", () => {
  it("un engagement qui a déjà sa liste de retour est écarté ; les autres restent", () => {
    expect(engagementsSansListeRetour(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"])
  })

  it("tous les engagements ont déjà leur liste : aucune cible", () => {
    expect(engagementsSansListeRetour(["a"], new Set(["a"]))).toEqual([])
  })
})

describe("point déjà lié dans la liste", () => {
  it("un point lié au même objet empêche un second ajout", () => {
    expect(pointDejaLie([{ lienType: "organe_garage", lienId: "o1" }], "organe_garage", "o1")).toBe(true)
  })

  it("un point lié à un autre objet ou à un autre type ne compte pas", () => {
    expect(pointDejaLie([{ lienType: "organe_garage", lienId: "o2" }], "organe_garage", "o1")).toBe(false)
    expect(pointDejaLie([{ lienType: "papier_voiture", lienId: "o1" }], "organe_garage", "o1")).toBe(false)
  })
})

describe("libellés construits depuis l'objet", () => {
  it("la pièce en zone rouge reprend le libellé de 956 et le nom de l'organe", () => {
    expect(titrePointPropose("organe_garage", "Moteur")).toBe("Remplacer la pièce : Moteur")
  })

  it("un papier, une licence, une homologation, un document et une contrepartie prennent leur nom", () => {
    expect(titrePointPropose("papier_voiture", "Carte grise")).toBe("Papier à renouveler : Carte grise")
    expect(titrePointPropose("licence_equipe", "Jean Dupont")).toBe("Licence à renouveler : Jean Dupont")
    expect(titrePointPropose("homologation_equipe", "Casque")).toBe("Homologation à renouveler : Casque")
    expect(titrePointPropose("document_documents", "Règlement FFSA")).toBe("Document à renouveler : Règlement FFSA")
    expect(titrePointPropose("contrepartie_partenaires", "Logo sur la voiture")).toBe("Contrepartie en retard : Logo sur la voiture")
  })

  it("le règlement publié demande de le relire, avec son titre", () => {
    expect(titreRelireReglement("Règlement particulier")).toBe("Relire le règlement : Règlement particulier")
  })
})
