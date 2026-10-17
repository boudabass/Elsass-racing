import { describe, expect, it } from "vitest"

import { manifesteSettings } from "../../apps/settings/manifest"

import { entreeVisible, validerManifeste, type ManifesteApp } from "./manifeste"

function copie(): ManifesteApp {
  return structuredClone(manifesteSettings)
}

describe("validerManifeste", () => {
  it("accepte le manifeste de Réglages", () => {
    expect(validerManifeste(manifesteSettings)).toEqual([])
  })

  it("refuse une clé d'app inconnue", () => {
    const m = { ...copie(), cle: "inconnue" as ManifesteApp["cle"] }
    expect(validerManifeste(m)).toEqual([expect.stringContaining("n'existe pas")])
  })

  it("refuse une version ou un nom différent du catalogue", () => {
    const m = { ...copie(), version: "9.9.9", nom: "Autre" }
    const erreurs = validerManifeste(m)
    expect(erreurs.some((e) => e.includes("version"))).toBe(true)
    expect(erreurs.some((e) => e.includes("nom"))).toBe(true)
  })

  it("refuse un événement émis qui n'appartient pas à l'app", () => {
    const m = { ...copie(), evenementsEmis: ["budget.depense_creee"] }
    expect(validerManifeste(m)).toEqual([expect.stringContaining("budget.depense_creee")])
  })

  it("accepte les motifs génériques d'action émis par l'app", () => {
    const m = { ...copie(), evenementsEmis: ["settings.action_requise", "settings.action_levee"] }
    expect(validerManifeste(m)).toEqual([])
  })

  it("refuse un événement écouté que l'app ne reçoit pas", () => {
    const m = { ...copie(), evenementsEcoutes: ["saison.engagement_cree"] }
    expect(validerManifeste(m)).toEqual([expect.stringContaining("n'écoute pas")])
  })

  it("accepte core.action_decidee en écoute", () => {
    const m = { ...copie(), evenementsEcoutes: ["core.action_decidee"] }
    expect(validerManifeste(m)).toEqual([])
  })

  it("refuse un widget absent du catalogue de l'app", () => {
    const m = { ...copie(), widgets: [{ cle: "inexistant", nom: "Inexistant" }] }
    expect(validerManifeste(m)).toEqual([expect.stringContaining("inexistant")])
  })

  it("refuse deux widgets de même clé", () => {
    const m = {
      ...copie(),
      cle: "saison" as const,
      nom: "Saison",
      icone: "calendar-days",
      version: "0.1.0",
      requiert: [],
      evenementsEmis: [],
      evenementsEcoutes: [],
      widgets: [
        { cle: "bilan-saison", nom: "Bilan" },
        { cle: "bilan-saison", nom: "Bilan" },
      ],
    }
    expect(validerManifeste(m)).toEqual([expect.stringContaining("deux fois")])
  })

  it("refuse un chemin de menu sans barre oblique initiale", () => {
    const m = { ...copie(), menu: [{ libelle: "Identité", chemin: "identite" }] }
    expect(validerManifeste(m)).toEqual([expect.stringContaining("identite")])
  })
})

describe("entreeVisible : droits d'une entrée de menu", () => {
  it("sans règle, l'entrée suit le niveau d'accès à l'app", () => {
    expect(entreeVisible({ libelle: "Mouvements", chemin: "/" }, "lecture")).toBe(true)
  })

  it("niveauMinimum masque l'entrée en dessous du niveau requis", () => {
    const aConfirmer = { libelle: "À confirmer", chemin: "/a-confirmer", niveauMinimum: "ecriture" as const }
    expect(entreeVisible(aConfirmer, "contribution")).toBe(false)
    expect(entreeVisible(aConfirmer, "ecriture")).toBe(true)
  })

  it("masquePour cache l'entrée aux niveaux listés, sans toucher aux autres", () => {
    const previsionnel = { libelle: "Prévisionnel", chemin: "/previsionnel", masquePour: ["contribution" as const] }
    expect(entreeVisible(previsionnel, "contribution")).toBe(false)
    expect(entreeVisible(previsionnel, "lecture")).toBe(true)
    expect(entreeVisible(previsionnel, "gestion")).toBe(true)
  })
})
