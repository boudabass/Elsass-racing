import { describe, expect, it, vi } from "vitest"

import type { ContexteTeam } from "@/core/contexte"

import { controleLecturePour, enregistrerControleLecture, rattachementOuvert } from "./controles-lecture"

const ctx = {} as ContexteTeam

describe("rattachementOuvert", () => {
  it("refuse sans appeler le contrôle quand le niveau d'app est sous la lecture", async () => {
    const peutLire = vi.fn(async () => true)
    enregistrerControleLecture({ app: "test-niveau", ficheType: "fiche", peutLire })
    const ouvert = await rattachementOuvert(ctx, { app: "test-niveau", ficheType: "fiche", ficheId: "f1" }, "aucun")
    expect(ouvert).toBe(false)
    expect(peutLire).not.toHaveBeenCalled()
  })

  it("accorde sans contrôle quand l'app n'en déclare pas, dès que le niveau donne la lecture", async () => {
    expect(await rattachementOuvert(ctx, { app: "test-sans-controle", ficheType: "fiche", ficheId: "f1" }, "lecture")).toBe(true)
    expect(await rattachementOuvert(ctx, { app: "test-sans-controle", ficheType: "fiche", ficheId: "f1" }, undefined)).toBe(false)
  })

  it("suit le contrôle de la fiche quand le niveau le permet, avec l'identifiant de la fiche", async () => {
    const peutLire = vi.fn(async (_ctx: ContexteTeam, id: string) => id === "ouverte")
    enregistrerControleLecture({ app: "test-fiche", ficheType: "dossier", peutLire })
    expect(await rattachementOuvert(ctx, { app: "test-fiche", ficheType: "dossier", ficheId: "ouverte" }, "contribution")).toBe(true)
    expect(await rattachementOuvert(ctx, { app: "test-fiche", ficheType: "dossier", ficheId: "fermee" }, "contribution")).toBe(false)
    expect(peutLire).toHaveBeenCalledWith(ctx, "ouverte")
  })
})

describe("controleLecturePour", () => {
  it("renvoie le contrôle enregistré pour la paire app et type de fiche, sinon null", () => {
    enregistrerControleLecture({ app: "test-cherche", ficheType: "type", peutLire: async () => false })
    expect(controleLecturePour("test-cherche", "type")?.app).toBe("test-cherche")
    expect(controleLecturePour("test-cherche", "autre")).toBeNull()
    expect(controleLecturePour("autre-app", "type")).toBeNull()
  })
})
