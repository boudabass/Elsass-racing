import { describe, expect, it } from "vitest"

import { manifesteSettings } from "../../apps/settings/manifest"
import { DROITS_PAR_DEFAUT } from "../catalogue"

import { calculerApps } from "./apps"
import type { ManifesteApp } from "./manifeste"

const autreManifeste: ManifesteApp = {
  ...manifesteSettings,
  cle: "budget",
  nom: "Budget",
  icone: "euro",
  version: "0.1.0",
  requiert: [],
  menu: [],
  widgets: [],
  evenementsEmis: [],
  evenementsEcoutes: [],
}

describe("calculerApps", () => {
  it("garde les apps activées de niveau au moins lecture, dans l'ordre", () => {
    const visibles = calculerApps({
      role: "responsable",
      activees: [
        { appCle: "budget", activee: true, ordre: 2 },
        { appCle: "settings", activee: true, ordre: 1 },
      ],
      acces: [],
      defauts: DROITS_PAR_DEFAUT,
      registre: [manifesteSettings, autreManifeste],
      avertir: () => {},
    })
    expect(visibles.map((v) => v.manifeste.cle)).toEqual(["budget", "settings"])
  })

  it("place Réglages en dernier pour le responsable, même si son ordre est plus petit", () => {
    const visibles = calculerApps({
      role: "responsable",
      activees: [
        { appCle: "settings", activee: true, ordre: 1 },
        { appCle: "budget", activee: true, ordre: 5 },
      ],
      acces: [],
      defauts: DROITS_PAR_DEFAUT,
      registre: [manifesteSettings, autreManifeste],
      avertir: () => {},
    })
    expect(visibles.at(-1)?.manifeste.cle).toBe("settings")
  })

  it("ignore une app désactivée", () => {
    const visibles = calculerApps({
      role: "responsable",
      activees: [{ appCle: "budget", activee: false, ordre: 1 }],
      acces: [],
      defauts: DROITS_PAR_DEFAUT,
      registre: [autreManifeste],
      avertir: () => {},
    })
    expect(visibles).toEqual([])
  })

  it("masque une app dont le niveau effectif est aucun", () => {
    const visibles = calculerApps({
      role: "invite",
      activees: [{ appCle: "budget", activee: true, ordre: 1 }],
      acces: [],
      defauts: DROITS_PAR_DEFAUT,
      registre: [autreManifeste],
      avertir: () => {},
    })
    expect(visibles).toEqual([])
  })

  it("Réglages reste visible à l'assistance, au niveau aucun, pour ses rubriques personnelles", () => {
    const visibles = calculerApps({
      role: "assistance",
      activees: [{ appCle: "settings", activee: true, ordre: 1 }],
      acces: [],
      defauts: DROITS_PAR_DEFAUT,
      registre: [manifesteSettings],
      avertir: () => {},
    })
    expect(visibles.map((v) => [v.manifeste.cle, v.niveau])).toEqual([["settings", "aucun"]])
  })

  it("un core_app_access de lecture rend une app visible à l'invité", () => {
    const visibles = calculerApps({
      role: "invite",
      activees: [{ appCle: "budget", activee: true, ordre: 1 }],
      acces: [{ appCle: "budget", niveau: "lecture" }],
      defauts: DROITS_PAR_DEFAUT,
      registre: [autreManifeste],
      avertir: () => {},
    })
    expect(visibles.map((v) => v.niveau)).toEqual(["lecture"])
  })

  it("ignore une app absente du registre et le signale", () => {
    const messages: string[] = []
    const visibles = calculerApps({
      role: "responsable",
      activees: [{ appCle: "voiture", activee: true, ordre: 1 }],
      acces: [],
      defauts: DROITS_PAR_DEFAUT,
      registre: [manifesteSettings],
      avertir: (message) => messages.push(message),
    })
    expect(visibles).toEqual([])
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain("voiture")
  })
})
