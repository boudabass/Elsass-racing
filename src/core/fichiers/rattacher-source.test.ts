// Liaison entre apps (brief 3.8, §1) : un fichier ne se rattache à une autre fiche que s'il est déjà rattaché à la
// fiche source, dans la même team. Client factice : la base est couverte par db:verifier-rls.
import { beforeAll, describe, expect, it, vi } from "vitest"

import type { ContexteTeam } from "@/core/contexte"

type Fiche = { app: string; ficheType: string; ficheId: string }

let rattacherDepuisSource: typeof import("./fichiers-serveur").rattacherDepuisSource

beforeAll(async () => {
  // Le module ouvre le client Prisma au chargement : une URL factice suffit, aucune requête n'est envoyée.
  process.env.DATABASE_URL ??= "postgresql://factice:factice@localhost:1/factice"
  ;({ rattacherDepuisSource } = await import("./fichiers-serveur"))
})

const ctx: ContexteTeam = { teamId: "team-a", userId: "user-b", membership: { id: "m-b", role: "equipage" } }
const source: Fiche = { app: "voiture", ficheType: "occupation", ficheId: "occ-1" }
const cible = { app: "partenaires", ficheType: "proof", ficheId: "preuve-1", role: "photo" as const }

// Client factice : un fichier de la team (envoyé par un autre membre), et des rattachements à volonté.
function clientFactice(options: { fichierDansTeam: boolean; rattacheALaSource: boolean }) {
  const creer = vi.fn(async () => ({}))
  const client = {
    coreFile: {
      findFirst: vi.fn(async () => (options.fichierDansTeam ? { id: "f-1" } : null)),
    },
    coreAttachment: {
      findFirst: vi.fn(async (args: { where: { app?: string; ficheType?: string } }) => {
        // Premier appel : le rattachement à la source. Les suivants : doublon sur la cible, absent.
        if (args.where.app === source.app && args.where.ficheType === source.ficheType) return options.rattacheALaSource ? { id: "a-1" } : null
        return null
      }),
      create: creer,
    },
  }
  return { client, creer }
}

describe("rattacherDepuisSource", () => {
  it("refuse un fichier qui n'est pas rattaché à la fiche source", async () => {
    const { client, creer } = clientFactice({ fichierDansTeam: true, rattacheALaSource: false })
    await expect(rattacherDepuisSource(client as never, ctx, { fileId: "f-1", source, cible })).rejects.toThrow("n'est pas rattaché")
    expect(creer).not.toHaveBeenCalled()
  })

  it("refuse un fichier d'une autre team", async () => {
    const { client, creer } = clientFactice({ fichierDansTeam: false, rattacheALaSource: true })
    await expect(rattacherDepuisSource(client as never, ctx, { fileId: "f-1", source, cible })).rejects.toThrow("Fichier introuvable")
    expect(creer).not.toHaveBeenCalled()
  })

  it("rattache à la cible un fichier envoyé par un autre membre, dès qu'il est rattaché à la source", async () => {
    const { client, creer } = clientFactice({ fichierDansTeam: true, rattacheALaSource: true })
    await rattacherDepuisSource(client as never, ctx, { fileId: "f-1", source, cible })
    expect(creer).toHaveBeenCalledTimes(1)
    const donnees = (creer.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data
    expect(donnees).toMatchObject({ teamId: "team-a", fileId: "f-1", app: "partenaires", ficheType: "proof", ficheId: "preuve-1", role: "photo", createdBy: "user-b" })
  })
})
