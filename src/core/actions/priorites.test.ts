import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { PRIORITE, prioriteEcheance, pourquoi, RANG_PAR_TYPE, TYPES_A_ECHEANCE } from "./priorites"

describe("table des priorités", () => {
  it("garde les rangs de l'article 960, section 5", () => {
    expect(PRIORITE).toEqual({
      bloquant: 1,
      echeance_depassee: 2,
      resultat: 3,
      mouvement_a_confirmer: 4,
      contrepartie: 5,
      relance: 6,
      suggestion: 7,
      proposition: 8,
      echeance_proche: 9,
    })
  })

  it("donne à chaque type à rang fixe un rang de la table, et aucun type à échéance n'y figure", () => {
    for (const rang of Object.values(RANG_PAR_TYPE)) expect(Object.values(PRIORITE)).toContain(rang)
    for (const type of TYPES_A_ECHEANCE) expect(RANG_PAR_TYPE).not.toHaveProperty(type)
  })

  it("range une proposition d'une autre app après une suggestion de préparation", () => {
    expect(RANG_PAR_TYPE.point_critique).toBe(PRIORITE.suggestion)
    expect(RANG_PAR_TYPE.ajouter_point).toBe(PRIORITE.proposition)
    expect(RANG_PAR_TYPE.cloture_saison_proposee).toBe(PRIORITE.proposition)
    expect(RANG_PAR_TYPE.resultat_a_valider).toBe(PRIORITE.resultat)
    expect(RANG_PAR_TYPE.tache_relance).toBe(PRIORITE.relance)
  })
})

describe("priorité d'une échéance : 2 le jour J ou après, 9 avant", () => {
  const maintenant = new Date("2026-11-05T10:00:00Z")

  it("la date passée et la date du jour donnent 2", () => {
    expect(prioriteEcheance(new Date("2026-11-04T00:00:00Z"), maintenant)).toBe(2)
    expect(prioriteEcheance(new Date("2026-11-05T00:00:00Z"), maintenant)).toBe(2)
  })

  it("une date à venir donne 9", () => {
    expect(prioriteEcheance(new Date("2026-11-06T00:00:00Z"), maintenant)).toBe(9)
  })

  it("le rang passe de 9 à 2 le jour J (réémission au recalcul)", () => {
    const echeance = new Date("2026-11-12T00:00:00Z")
    expect(prioriteEcheance(echeance, new Date("2026-11-11T20:00:00Z"))).toBe(9)
    expect(prioriteEcheance(echeance, new Date("2026-11-12T08:00:00Z"))).toBe(2)
  })

  it("le jour civil est celui de Paris : 23 h UTC le 11 est déjà le 12 à Paris", () => {
    expect(prioriteEcheance(new Date("2026-11-12T00:00:00Z"), new Date("2026-11-11T23:30:00Z"))).toBe(2)
  })
})

describe("ligne « pourquoi »", () => {
  it("donne une ligne par rang", () => {
    expect(pourquoi(1, "Rallye du Florival")).toBe("Bloquant pour Rallye du Florival")
    expect(pourquoi(1)).toBe("Bloquant")
    expect(pourquoi(2)).toBe("Échéance dépassée ou aujourd'hui")
    expect(pourquoi(3)).toBe("Résultat à saisir ou à valider : trophées et statistiques en attente")
    expect(pourquoi(4)).toBe("Mouvement à confirmer")
    expect(pourquoi(5)).toBe("Contrepartie ou preuve de partenaire à régler")
    expect(pourquoi(6)).toBe("Relance due")
    expect(pourquoi(7)).toBe("Suggestion de préparation")
    expect(pourquoi(8)).toBe("Proposition à confirmer")
    expect(pourquoi(9)).toBe("Échéance proche")
  })
})

describe("garde-fou : aucune priorité en dur dans les apps", () => {
  const racine = path.resolve(__dirname, "../../apps")
  // « priorite: 5 » ou « PRIORITE_X = 5 » : un chiffre à la place d'un rang nommé de la table.
  const CHIFFRE = /\bpriorite:\s*\d|\bPRIORITE_\w+\s*=\s*\d/

  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = path.join(dossier, nom)
      if (statSync(chemin).isDirectory()) return fichiers(chemin)
      return nom.endsWith(".ts") && !nom.endsWith(".test.ts") ? [chemin] : []
    })
  }

  it("toute priorité d'émission passe par PRIORITE (src/core/actions/priorites.ts)", () => {
    const fautifs = fichiers(racine).filter((chemin) => CHIFFRE.test(readFileSync(chemin, "utf8")))
    expect(fautifs.map((chemin) => path.relative(racine, chemin))).toEqual([])
  })
})
