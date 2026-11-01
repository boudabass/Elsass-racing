import { describe, expect, it } from "vitest"

import { chargeProblemeSignale } from "./charges"

const LISTE = "11111111-1111-4111-8111-111111111111"
const EPREUVE = "22222222-2222-4222-8222-222222222222"
const POINT = "33333333-3333-4333-8333-333333333333"
const ORGANE = "44444444-4444-4444-8444-444444444444"

describe("charge de checklist.probleme_signale (5.7a)", () => {
  it("un événement émis avant 5.7a (sans contexte du point) reste valide", () => {
    expect(chargeProblemeSignale.safeParse({ listeId: LISTE, epreuveId: EPREUVE, pointId: POINT }).success).toBe(true)
  })

  it("porte le libellé, le titre de la liste et le lien du point", () => {
    const analyse = chargeProblemeSignale.safeParse({
      listeId: LISTE,
      epreuveId: EPREUVE,
      pointId: POINT,
      libelle: "Contrôle du moteur",
      listeTitre: "Avant départ",
      lienType: "organe_garage",
      lienId: ORGANE,
    })
    expect(analyse.success).toBe(true)
  })

  it("accepte un point sans lien : lienType et lienId nuls", () => {
    expect(
      chargeProblemeSignale.safeParse({ listeId: LISTE, epreuveId: EPREUVE, pointId: POINT, libelle: "Pneus", listeTitre: "Vérifs", lienType: null, lienId: null })
        .success,
    ).toBe(true)
  })

  it("refuse une clé inconnue : la charge reste stricte", () => {
    expect(chargeProblemeSignale.safeParse({ listeId: LISTE, epreuveId: EPREUVE, pointId: POINT, autre: "x" }).success).toBe(false)
  })

  it("refuse un identifiant de lien qui n'est pas un identifiant", () => {
    expect(chargeProblemeSignale.safeParse({ listeId: LISTE, epreuveId: EPREUVE, pointId: POINT, lienId: "pas-un-id" }).success).toBe(false)
  })
})
