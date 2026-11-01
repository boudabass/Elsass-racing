import { describe, expect, it } from "vitest"

import type { CandidatEtape } from "./prochaine-etape"
import { lienEtape, libelleAvancementEpreuve, libelleCritiquesOuverts, libelleEtape, libelleMesPoints, libelleProposition } from "./widgets"

const etape = (surcharge: Partial<CandidatEtape> & Pick<CandidatEtape, "raison">): CandidatEtape => ({
  listeId: "liste-1",
  listeTitre: "Commune",
  pointId: "point-1",
  libelle: "Triangle de présentation",
  echeance: "2026-11-10",
  ...surcharge,
})

describe("libellés des widgets de Check-lists (5.6 §3)", () => {
  it("l'avancement dit le nombre de listes et le pourcentage", () => {
    expect(libelleAvancementEpreuve(0, 0)).toBe("Aucune liste pour cette épreuve")
    expect(libelleAvancementEpreuve(1, 40)).toBe("1 liste · 40 %")
    expect(libelleAvancementEpreuve(3, 90)).toBe("3 listes · 90 %")
  })

  it("les critiques ouverts s'accordent au nombre", () => {
    expect(libelleCritiquesOuverts(0)).toBe("Aucun point critique ouvert")
    expect(libelleCritiquesOuverts(1)).toBe("1 point critique ouvert")
    expect(libelleCritiquesOuverts(2)).toBe("2 points critiques ouverts")
  })

  it("mes points et les propositions s'accordent au nombre", () => {
    expect(libelleMesPoints(0)).toBe("Aucun point à faire pour vous")
    expect(libelleMesPoints(1)).toBe("1 point à faire pour vous")
    expect(libelleProposition(0)).toBe("Aucune proposition en attente")
    expect(libelleProposition(2)).toBe("2 propositions en attente")
  })

  it("le bouton Prochaine étape nomme le point, et la phase suivante nomme la liste", () => {
    expect(libelleEtape(etape({ raison: "critique" }))).toBe("Point critique : Triangle de présentation (Commune)")
    expect(libelleEtape(etape({ raison: "pour_moi" }))).toBe("À faire pour vous : Triangle de présentation (Commune)")
    expect(libelleEtape(etape({ raison: "phase_suivante", pointId: null, libelle: null }))).toBe("Ouvrir la liste Commune, prochaine phase")
  })

  it("le lien mène au point dans sa liste, ou à la liste pour la phase suivante", () => {
    expect(lienEtape(etape({ raison: "critique" }))).toBe("/apps/checklist/liste/liste-1?point=point-1")
    expect(lienEtape(etape({ raison: "phase_suivante", pointId: null, libelle: null }))).toBe("/apps/checklist/liste/liste-1")
  })
})
