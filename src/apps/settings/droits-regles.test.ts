import { describe, expect, it } from "vitest"

import { appsQuiRequierent, deplacer, niveauAutorise, peutDesactiver } from "./droits-regles"

describe("un responsable garde la gestion de Réglages", () => {
  it("refuse un niveau inférieur à gestion sur settings pour un responsable", () => {
    expect(niveauAutorise("responsable", "settings", "ecriture")).toBe(false)
    expect(niveauAutorise("responsable", "settings", "lecture")).toBe(false)
  })

  it("accepte gestion sur settings pour un responsable", () => {
    expect(niveauAutorise("responsable", "settings", "gestion")).toBe(true)
  })

  it("laisse libres les autres rôles et les autres apps", () => {
    expect(niveauAutorise("equipage", "settings", "aucun")).toBe(true)
    expect(niveauAutorise("responsable", "budget", "aucun")).toBe(true)
  })
})

describe("dépendances entre apps", () => {
  it("garage requiert voiture : voiture ne peut pas être désactivée tant que garage est active", () => {
    expect(appsQuiRequierent("voiture", ["voiture", "garage"])).toEqual(["garage"])
    expect(peutDesactiver("voiture", ["voiture", "garage"])).toEqual({ ok: false, raison: "Requise par Garage" })
  })

  it("voiture peut être désactivée si garage est déjà désactivée", () => {
    expect(peutDesactiver("voiture", ["voiture"])).toEqual({ ok: true })
  })

  it("Réglages ne peut jamais être désactivée", () => {
    expect(peutDesactiver("settings", ["settings"]).ok).toBe(false)
  })
})

describe("déplacement dans l'ordre des apps", () => {
  const apps = [
    { appCle: "saison", ordre: 1 },
    { appCle: "budget", ordre: 2 },
    { appCle: "settings", ordre: 3 },
  ]

  it("monte une app d'un cran", () => {
    expect(deplacer(apps, "budget", -1)).toEqual([
      { appCle: "budget", ordre: 1 },
      { appCle: "saison", ordre: 2 },
      { appCle: "settings", ordre: 3 },
    ])
  })

  it("refuse de monter la première et de descendre la dernière", () => {
    expect(deplacer(apps, "saison", -1)).toBeNull()
    expect(deplacer(apps, "settings", 1)).toBeNull()
  })
})
