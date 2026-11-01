import { describe, expect, it } from "vitest"

import { actionSansDecision, cheminLienValide, effetDuBouton, motifLienRefuse } from "./liens"

describe("chemin d'un bouton-lien", () => {
  it("reste dans l'app d'origine : /apps/<app> et ses sous-chemins", () => {
    expect(cheminLienValide("/apps/checklist", "checklist")).toBe(true)
    expect(cheminLienValide("/apps/equipe/personnes/abc", "equipe")).toBe(true)
    expect(cheminLienValide("/apps/equipe/epreuve?onglet=dispo", "equipe")).toBe(true)
  })

  it("refuse une adresse absolue, un protocole, une barre double, un « .. » et une autre app", () => {
    expect(cheminLienValide("https://exemple.invalid/apps/checklist", "checklist")).toBe(false)
    expect(cheminLienValide("//exemple.invalid/apps/checklist", "checklist")).toBe(false)
    expect(cheminLienValide("/apps/checklist/../qg", "checklist")).toBe(false)
    expect(cheminLienValide("/apps/checklist\\..\\qg", "checklist")).toBe(false)
    expect(cheminLienValide("/apps/equipe", "checklist")).toBe(false)
    expect(cheminLienValide("/apps/checklistx", "checklist")).toBe(false)
    expect(cheminLienValide("", "checklist")).toBe(false)
  })
})

describe("refus d'un lien à l'émission", () => {
  it("refuse une charge dont un bouton pointe hors de l'app émettrice", () => {
    const motif = motifLienRefuse("equipe.action_requise", {
      boutons: [{ cle: "renouveler", libelle: "Renouveler", lien: "/apps/garage/equipements" }],
    })
    expect(motif).toContain("Lien refusé")
  })

  it("accepte une charge dont les liens restent dans l'app, et une charge sans lien", () => {
    expect(motifLienRefuse("equipe.action_requise", { boutons: [{ cle: "renouveler", libelle: "Renouveler", lien: "/apps/equipe" }] })).toBeNull()
    expect(motifLienRefuse("equipe.action_requise", { boutons: [{ cle: "repondre", libelle: "Répondre" }] })).toBeNull()
  })

  it("ne regarde que les événements *.action_requise", () => {
    expect(motifLienRefuse("equipe.licence_expire_bientot", { boutons: [{ cle: "x", libelle: "X", lien: "/ailleurs" }] })).toBeNull()
  })
})

describe("décision d'un bouton-lien", () => {
  const boutons = [
    { cle: "voir", libelle: "Voir les listes", lien: "/apps/checklist" },
    { cle: "ignorer", libelle: "Ignorer" },
  ]

  it("un bouton-lien navigue, un bouton ordinaire décide", () => {
    expect(effetDuBouton(boutons, "voir")).toBe("lien")
    expect(effetDuBouton(boutons, "ignorer")).toBe("decider")
    expect(effetDuBouton(boutons, "inconnu")).toBeNull()
  })

  it("une action dont TOUS les boutons sont des liens ne se décide jamais au clic : elle reste en attente jusqu'à sa levée", () => {
    // Règle documentée (docs/evenements.md) : rien ne le vérifie automatiquement. Si l'app ne lève jamais l'action,
    // elle reste en attente jusqu'à l'expiration (30 jours après l'échéance), comme toute action non traitée.
    const tousLiens = [{ cle: "renouveler", libelle: "Renouveler", lien: "/apps/equipe/personnes/abc" }]
    expect(actionSansDecision(tousLiens)).toBe(true)
    expect(effetDuBouton(tousLiens, "renouveler")).toBe("lien")
  })

  it("une action avec un bouton qui décide n'est pas une action-lien seule", () => {
    expect(actionSansDecision(boutons)).toBe(false)
    expect(actionSansDecision([])).toBe(false)
  })
})
