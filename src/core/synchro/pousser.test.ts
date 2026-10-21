import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"

import type { Operation } from "./protocole"

// La poussée sans base : les écritures passent par un faux tx, la déclaration est fabriquée par le test. On vérifie
// la décision (statut, écriture ou non) et que apresApplication ne suit que les écritures.
const etat = vi.hoisted(() => ({
  declaration: null as null | Record<string, unknown>,
}))

vi.mock("./registre", () => ({ declarationDe: () => etat.declaration }))
vi.mock("@/core/actions/actions-serveur", () => ({ niveauDe: async () => "gestion" }))
vi.mock("@/lib/prisma", () => ({
  prismaPourTeam: () => ({ coreSyncOperation: { findUnique: async () => null } }),
  executerPourTeam: async (_teamId: string, _userId: string, fn: (tx: unknown) => Promise<unknown>) => fn(faux.tx),
}))

const faux = {
  tx: {
    coreSyncOperation: { create: async () => ({}) },
    coreActivity: { create: async () => ({}) },
  },
}

const ctx = { teamId: "team", userId: "compte", membership: { id: "membre" } } as unknown as ContexteTeam

function declarer(options: { trouver: unknown; apresApplication?: unknown }) {
  const apresApplication = options.apresApplication ?? vi.fn(async () => {})
  etat.declaration = {
    cle: "fake",
    ficheType: "fiche",
    app: "garage",
    niveauLecture: "contribution",
    contributionPropre: false,
    lectureSeule: false,
    schemaChamps: z.object({ titre: z.string() }).passthrough(),
    trouver: options.trouver,
    creer: vi.fn(async () => {}),
    modifier: vi.fn(async () => true),
    supprimer: vi.fn(async () => true),
    apresApplication,
  }
  return apresApplication as ReturnType<typeof vi.fn>
}

const existante = (rev: number, supprimee = false) => async () => ({ rev, auteurId: "compte", supprimee, contenu: { titre: "ancien" } })

async function pousser(operation: Partial<Operation> & Pick<Operation, "type">) {
  const { appliquerOperations } = await import("./pousser")
  const complete: Operation = { idOperation: "op-1", table: "fake", id: "ligne-1", champs: { titre: "Plaquettes" }, ...operation }
  const [resultat] = await appliquerOperations(ctx, "appareil", [complete])
  return resultat
}

describe("poussée : apresApplication ne suit que les écritures", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("une modification appliquée émet après écriture", async () => {
    const apres = declarer({ trouver: existante(2) })
    const resultat = await pousser({ type: "modifier", revLue: 2 })
    expect(resultat).toEqual({ idOperation: "op-1", statut: "appliquee" })
    expect(apres).toHaveBeenCalledTimes(1)
    expect(apres).toHaveBeenCalledWith(expect.anything(), "ligne-1", "modifier")
  })

  it("une modification en conflit résolu, avec écriture, émet aussi (garage.travail_termine)", async () => {
    const apres = declarer({ trouver: existante(3) })
    const resultat = await pousser({ type: "modifier", revLue: 2 })
    expect(resultat.statut).toBe("conflit_resolu")
    expect(apres).toHaveBeenCalledTimes(1)
  })

  it("une modification face à une ligne supprimée n'écrit rien et n'émet rien", async () => {
    const apres = declarer({ trouver: existante(3, true) })
    const resultat = await pousser({ type: "modifier", revLue: 2 })
    expect(resultat.statut).toBe("conflit_resolu")
    expect(apres).not.toHaveBeenCalled()
  })

  it("une suppression déjà faite n'écrit rien et n'émet rien", async () => {
    const apres = declarer({ trouver: existante(3, true) })
    const resultat = await pousser({ type: "supprimer", revLue: 3 })
    expect(resultat.statut).toBe("appliquee")
    expect(apres).not.toHaveBeenCalled()
  })

  it("une création appliquée émet après écriture", async () => {
    const apres = declarer({ trouver: async () => null })
    const resultat = await pousser({ type: "creer", revLue: undefined })
    expect(resultat.statut).toBe("appliquee")
    expect(apres).toHaveBeenCalledWith(expect.anything(), "ligne-1", "creer")
  })

  it("une opération refusée n'émet rien et garde sa raison", async () => {
    const apres = declarer({ trouver: existante(2) })
    const resultat = await pousser({ type: "modifier", revLue: 2, champs: {} })
    expect(resultat.statut).toBe("refusee")
    expect(resultat.raison).toBeTruthy()
    expect(apres).not.toHaveBeenCalled()
  })
})
