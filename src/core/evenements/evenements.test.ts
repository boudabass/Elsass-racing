import { describe, expect, it } from "vitest"

import { APPS } from "../catalogue"

import { EVENEMENTS } from "./catalogue"
import { abonnesDe, emetteurDe, estNomValide } from "./evenements"

const CLES_APPS = APPS.map((app) => app.cle)

describe("catalogue des événements", () => {
  it("contient 72 événements (71 d'apps et core.action_decidee)", () => {
    expect(EVENEMENTS).toHaveLength(72)
  })

  it("donne à chaque nom la forme app.fait_au_participe (minuscules, un point, underscores)", () => {
    for (const evenement of EVENEMENTS) {
      expect(evenement.nom, evenement.nom).toMatch(/^[a-z]+\.[a-z]+(_[a-z]+)*$/)
    }
  })

  it("n'a aucun nom en double", () => {
    const noms = EVENEMENTS.map((e) => e.nom)
    expect(new Set(noms).size).toBe(noms.length)
  })

  it("donne un émetteur connu, une clé d'app ou core", () => {
    for (const evenement of EVENEMENTS) {
      expect([...CLES_APPS, "core"], evenement.nom).toContain(evenement.emisPar)
    }
  })

  it("ne cite que des abonnés connus : une clé d'app, core ou *", () => {
    for (const evenement of EVENEMENTS) {
      for (const destinataire of evenement.ecoutePar) {
        expect([...CLES_APPS, "core", "*"], `${evenement.nom} → ${destinataire}`).toContain(destinataire)
      }
    }
  })

  it("aucune app ne s'écoute elle-même, dans les listes explicites", () => {
    for (const evenement of EVENEMENTS) {
      expect(evenement.ecoutePar, evenement.nom).not.toContain(evenement.emisPar)
    }
  })
})

describe("estNomValide", () => {
  it("accepte les noms du catalogue", () => {
    expect(estNomValide("saison.resultat_valide")).toBe(true)
    expect(estNomValide("core.action_decidee")).toBe(true)
  })

  it("accepte les motifs génériques d'une app du catalogue", () => {
    expect(estNomValide("saison.action_requise")).toBe(true)
    expect(estNomValide("garage.action_levee")).toBe(true)
  })

  it("refuse un motif générique d'une clé inconnue", () => {
    expect(estNomValide("inconnu.action_requise")).toBe(false)
  })

  it("refuse un nom hors catalogue", () => {
    expect(estNomValide("saison.nom_invente")).toBe(false)
    expect(estNomValide("saison.saison_supprimee")).toBe(false)
  })
})

describe("emetteurDe et abonnesDe", () => {
  it("donne l'émetteur d'un nom du catalogue", () => {
    expect(emetteurDe("budget.depense_creee")).toBe("budget")
    expect(emetteurDe("core.action_decidee")).toBe("core")
  })

  it("donne l'émetteur d'un motif générique", () => {
    expect(emetteurDe("voiture.action_requise")).toBe("voiture")
  })

  it("renvoie undefined pour un nom inconnu", () => {
    expect(emetteurDe("inconnu.action_requise")).toBeUndefined()
  })

  it("renvoie les abonnés explicites", () => {
    expect(abonnesDe("saison.engagement_cree").sort()).toEqual(["checklist", "equipe", "garage"])
  })

  it("étend * à toutes les apps sauf l'émetteur", () => {
    const abonnes = abonnesDe("settings.export_demande")
    expect(abonnes).not.toContain("settings")
    expect(abonnes.sort()).toEqual(CLES_APPS.filter((cle) => cle !== "settings").sort())
  })

  it("envoie les motifs génériques au socle", () => {
    expect(abonnesDe("saison.action_requise")).toEqual(["core"])
  })

  it("renvoie une liste vide pour core.action_decidee, destinataire dynamique", () => {
    expect(abonnesDe("core.action_decidee")).toEqual([])
  })

  it("renvoie une liste vide pour un nom inconnu", () => {
    expect(abonnesDe("inconnu.action_requise")).toEqual([])
  })
})
