import { describe, expect, it } from "vitest"

import {
  appDecouverte,
  confirmationCorrespond,
  dateDePurge,
  lireHeure,
  ludiqueEffectif,
  peutSupprimerCompte,
} from "./regles-personnelles"

describe("ludiqueEffectif", () => {
  it("suit le choix du membre quand la team affiche le ludique", () => {
    expect(ludiqueEffectif(true, "comme_la_team")).toBe(true)
    expect(ludiqueEffectif(true, "oui")).toBe(true)
    expect(ludiqueEffectif(true, "non")).toBe(false)
  })

  it("ne peut pas être réaffiché quand la team le masque", () => {
    expect(ludiqueEffectif(false, "oui")).toBe(false)
    expect(ludiqueEffectif(false, "comme_la_team")).toBe(false)
  })
})

describe("dateDePurge", () => {
  it("fixe la purge à trente jours après la demande", () => {
    const demande = new Date("2026-10-16T10:00:00Z")
    expect(dateDePurge(demande).toISOString()).toBe("2026-11-15T10:00:00.000Z")
  })
})

describe("confirmationCorrespond", () => {
  it("accepte la saisie exacte, aux espaces de bord près", () => {
    expect(confirmationCorrespond("  Koehling Racing Team ", "Koehling Racing Team")).toBe(true)
  })

  it("refuse une saisie différente, et une cible vide", () => {
    expect(confirmationCorrespond("Koehling", "Koehling Racing Team")).toBe(false)
    expect(confirmationCorrespond("", "")).toBe(false)
  })
})

describe("peutSupprimerCompte", () => {
  it("refuse au dernier responsable actif d'une team", () => {
    const verdict = peutSupprimerCompte([
      { teamNom: "Koehling Racing Team", role: "responsable", statut: "actif", autresResponsablesActifs: 0 },
    ])
    expect(verdict).toEqual({ ok: false, raison: "Nomme d'abord un autre responsable pour « Koehling Racing Team »." })
  })

  it("accepte quand un autre responsable existe, ou pour un simple membre", () => {
    expect(
      peutSupprimerCompte([{ teamNom: "T", role: "responsable", statut: "actif", autresResponsablesActifs: 1 }]),
    ).toEqual({ ok: true })
    expect(
      peutSupprimerCompte([{ teamNom: "T", role: "equipage", statut: "actif", autresResponsablesActifs: 0 }]),
    ).toEqual({ ok: true })
  })
})

describe("lireHeure", () => {
  it("accepte HH:MM et renvoie null pour une valeur vide", () => {
    expect(lireHeure("22:30")).toEqual({ ok: true, valeur: "22:30" })
    expect(lireHeure("  ")).toEqual({ ok: true, valeur: null })
  })

  it("refuse les autres formats", () => {
    expect(lireHeure("24:00")).toEqual({ ok: false })
    expect(lireHeure("9h30")).toEqual({ ok: false })
  })
})

describe("appDecouverte", () => {
  it("indique si le membre a déjà commencé l'app", () => {
    expect(appDecouverte("saison", ["saison"])).toBe(true)
    expect(appDecouverte("budget", ["saison"])).toBe(false)
  })
})
