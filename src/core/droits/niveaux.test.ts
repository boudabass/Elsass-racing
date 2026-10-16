import { describe, expect, it } from "vitest"

import { APPS, DROITS_PAR_DEFAUT } from "../catalogue"

import { aAuMoins, niveauEffectif, NIVEAUX, rangNiveau } from "./niveaux"
import { libelleErreurAcces, ErreurAcces } from "./erreurs"

const ROLES = ["responsable", "equipage", "assistance", "invite"] as const

describe("ordre des niveaux", () => {
  it("va de aucun à gestion, dans cet ordre", () => {
    expect(NIVEAUX).toEqual(["aucun", "lecture", "contribution", "ecriture", "gestion"])
    expect(rangNiveau("aucun")).toBeLessThan(rangNiveau("lecture"))
    expect(rangNiveau("gestion")).toBeGreaterThan(rangNiveau("ecriture"))
  })

  it("aAuMoins compare dans cet ordre", () => {
    expect(aAuMoins("gestion", "ecriture")).toBe(true)
    expect(aAuMoins("contribution", "ecriture")).toBe(false)
    expect(aAuMoins("lecture", "lecture")).toBe(true)
    expect(aAuMoins("aucun", "lecture")).toBe(false)
  })
})

describe("niveauEffectif", () => {
  it("donne le bon niveau pour les 44 défauts du catalogue", () => {
    expect(DROITS_PAR_DEFAUT).toHaveLength(44)
    for (const droit of DROITS_PAR_DEFAUT) {
      const niveau = niveauEffectif({
        role: droit.role,
        appCle: droit.appCle,
        acces: [],
        defauts: DROITS_PAR_DEFAUT,
      })
      expect(niveau, `${droit.role} / ${droit.appCle}`).toBe(droit.niveau)
    }
  })

  it("couvre tous les rôles sur toutes les apps du catalogue", () => {
    for (const role of ROLES) {
      for (const app of APPS) {
        const niveau = niveauEffectif({ role, appCle: app.cle, acces: [], defauts: DROITS_PAR_DEFAUT })
        expect(NIVEAUX).toContain(niveau)
      }
    }
  })

  it("un core_app_access prime sur le défaut du rôle", () => {
    const niveau = niveauEffectif({
      role: "invite",
      appCle: "budget",
      acces: [{ appCle: "budget", niveau: "lecture" }],
      defauts: DROITS_PAR_DEFAUT,
    })
    expect(niveau).toBe("lecture")
  })

  it("un core_app_access peut aussi retirer un droit par défaut", () => {
    const niveau = niveauEffectif({
      role: "responsable",
      appCle: "saison",
      acces: [{ appCle: "saison", niveau: "aucun" }],
      defauts: DROITS_PAR_DEFAUT,
    })
    expect(niveau).toBe("aucun")
  })

  it("une app inconnue donne aucun", () => {
    expect(
      niveauEffectif({ role: "responsable", appCle: "inexistante", acces: [], defauts: DROITS_PAR_DEFAUT }),
    ).toBe("aucun")
  })

  it("un invité n'a aucun droit, sur aucune app", () => {
    for (const app of APPS) {
      expect(
        niveauEffectif({ role: "invite", appCle: app.cle, acces: [], defauts: DROITS_PAR_DEFAUT }),
        app.cle,
      ).toBe("aucun")
    }
  })

  it("sans défaut ni accès, le niveau est aucun", () => {
    expect(niveauEffectif({ role: "responsable", appCle: "saison", acces: [], defauts: [] })).toBe("aucun")
  })
})

describe("libelleErreurAcces", () => {
  it("dit pourquoi pour chaque raison", () => {
    expect(libelleErreurAcces(new ErreurAcces("non_connecte", "aucun", "lecture", "budget"))).toMatch(/connect/)
    expect(libelleErreurAcces(new ErreurAcces("aucune_team", "aucun", "lecture", "budget"))).toMatch(/team/)
  })

  it("renvoie le message du responsable quand la gestion est requise", () => {
    expect(libelleErreurAcces(new ErreurAcces("niveau_insuffisant", "ecriture", "gestion", "budget"))).toBe(
      "Réservé au responsable de la team. Demande-lui l'accès.",
    )
  })
})
