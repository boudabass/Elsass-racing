import { describe, expect, it } from "vitest"

import { bilanApport, rangDepuisOrigine, type VersementLu } from "./apport"

const aujourdhui = "2026-10-19"

function versement(rang: number, date: string, montantCentimes: number, statut: "prevue" | "encaissee" = "prevue"): VersementLu {
  return { id: `v${rang}`, rang, date, montantCentimes, statut, encaisseeLe: statut === "encaissee" ? date : null }
}

describe("bilanApport", () => {
  it("calcule reçu et reste, sans trop perçu", () => {
    const bilan = bilanApport({
      attenduCentimes: 100_000,
      versements: [versement(1, "2026-03-15", 50_000, "encaissee"), versement(2, "2026-12-15", 50_000)],
      aujourdhui,
    })
    expect(bilan.recuCentimes).toBe(50_000)
    expect(bilan.resteCentimes).toBe(50_000)
    expect(bilan.tropCentimes).toBe(0)
    expect(bilan.sansVersement).toBe(false)
  })

  it("trop perçu : le reste reste à zéro et l'excédent est signalé", () => {
    const bilan = bilanApport({
      attenduCentimes: 100_000,
      versements: [versement(1, "2026-03-15", 120_000, "encaissee")],
      aujourdhui,
    })
    expect(bilan.recuCentimes).toBe(120_000)
    expect(bilan.resteCentimes).toBe(0)
    expect(bilan.tropCentimes).toBe(20_000)
  })

  it("aucun versement : le reste est l'apport entier, et le cas est marqué", () => {
    const bilan = bilanApport({ attenduCentimes: 75_000, versements: [], aujourdhui })
    expect(bilan.recuCentimes).toBe(0)
    expect(bilan.resteCentimes).toBe(75_000)
    expect(bilan.sansVersement).toBe(true)
    expect(bilan.versements).toEqual([])
  })

  it("aucun apport attendu : pas de reste, pas de cas « sans versement »", () => {
    const bilan = bilanApport({ attenduCentimes: 0, versements: [], aujourdhui })
    expect(bilan.resteCentimes).toBe(0)
    expect(bilan.sansVersement).toBe(false)
  })

  it("un versement échu et non encaissé est en retard ; celui du jour et celui à venir ne le sont pas", () => {
    const bilan = bilanApport({
      attenduCentimes: 300_000,
      versements: [versement(1, "2026-03-15", 100_000, "encaissee"), versement(2, "2026-10-01", 100_000), versement(3, "2026-10-19", 50_000), versement(4, "2026-12-15", 50_000)],
      aujourdhui,
    })
    expect(bilan.versements.map((v) => v.etat)).toEqual(["encaisse", "en_retard", "prevu", "prevu"])
  })

  it("un versement encaissé à une date passée reste encaissé, jamais en retard", () => {
    const bilan = bilanApport({ attenduCentimes: 100_000, versements: [versement(1, "2026-01-10", 100_000, "encaissee")], aujourdhui })
    expect(bilan.versements[0].etat).toBe("encaisse")
  })

  it("trie les versements par rang, quel que soit l'ordre reçu", () => {
    const bilan = bilanApport({
      attenduCentimes: 100_000,
      versements: [versement(2, "2026-09-15", 50_000), versement(1, "2026-03-15", 50_000)],
      aujourdhui,
    })
    expect(bilan.versements.map((v) => v.rang)).toEqual([1, 2])
  })
})

describe("rangDepuisOrigine", () => {
  it("lit le rang de partenaires:<convention>:<rang>", () => {
    expect(rangDepuisOrigine("partenaires:0b6c1f2e-aaaa:3")).toBe(3)
  })

  it("renvoie 0 pour une origine absente ou mal formée", () => {
    expect(rangDepuisOrigine(null)).toBe(0)
    expect(rangDepuisOrigine("partenaires:abc:")).toBe(0)
    expect(rangDepuisOrigine("partenaires:abc:x")).toBe(0)
  })
})
