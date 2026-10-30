import { describe, expect, it } from "vitest"

import { grouperParOrigine, origineDeclaree } from "./origines-regles"
import type { OrigineFichier } from "./types-origine"

// Origines de test : sans accès base, sans import d'app.
const vehicule: OrigineFichier = { app: "voiture", ficheType: "vehicle", fichesVisibles: async () => [] }
const depense: OrigineFichier = { app: "budget", ficheType: "expense", fichesVisibles: async () => [] }
const masquee: OrigineFichier = { app: "equipe", ficheType: "licence", masque: "à brancher", fichesVisibles: async () => [] }
const liste = [vehicule, depense, masquee]

describe("règles du registre des origines", () => {
  it("un type non déclaré n'entre dans aucun groupe : il n'est pas affiché", () => {
    const groupes = grouperParOrigine(liste, [
      { app: "inconnue", ficheType: "truc", ficheId: "1" },
      { app: "voiture", ficheType: "vehicle", ficheId: "2" },
    ])
    expect(groupes.size).toBe(1)
    expect(groupes.get(vehicule)).toEqual(["2"])
  })

  it("un même type de fiche regroupe ses identifiants dans un seul groupe", () => {
    const groupes = grouperParOrigine(liste, [
      { app: "budget", ficheType: "expense", ficheId: "a" },
      { app: "budget", ficheType: "expense", ficheId: "b" },
    ])
    expect(groupes.size).toBe(1)
    expect(groupes.get(depense)).toEqual(["a", "b"])
  })

  it("un type déclaré mais masqué reste dans le groupe, sa raison est dite", () => {
    const groupes = grouperParOrigine(liste, [{ app: "equipe", ficheType: "licence", ficheId: "x" }])
    expect(groupes.get(masquee)).toEqual(["x"])
    expect(origineDeclaree(liste, "equipe", "licence")?.masque).toBe("à brancher")
  })

  it("un type absent de la liste déclarée n'est jamais résolu", () => {
    expect(origineDeclaree(liste, "partenaires", "partner")).toBeNull()
  })
})
