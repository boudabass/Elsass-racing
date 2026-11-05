// Tâches du socle (tâche 5.8, §3.2 et §3.3) : le gestionnaire de la relance, la levée d'une action « tache_ » qui termine
// la tâche qu'elle porte, et le garde-fou qui interdit à une app d'écrire core_task.
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const appel = async (_args: Record<string, unknown>) => ({})
  const tx = { coreTask: { create: vi.fn(appel), updateMany: vi.fn(appel), update: vi.fn(appel) } }
  return {
    tx,
    prisma: {
      coreTask: { findFirst: vi.fn(async () => null as null | { id: string }), updateMany: vi.fn(appel) },
      coreAction: { findFirst: vi.fn(async () => null as null | Record<string, unknown>), updateMany: vi.fn(appel) },
    },
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {},
  prismaPourTeam: () => mocks.prisma,
  executerPourTeam: async (_teamId: string, _userId: string, requete: (tx: unknown) => Promise<unknown>) => requete(mocks.tx),
}))
vi.mock("@/core/client-contexte-serveur", () => ({ clientPourContexte: () => mocks.prisma }))

import "@/core/taches/taches-serveur"
import "@/core/actions/gestionnaires-serveur"
import { trouverGestionnaire } from "@/core/evenements/gestionnaires"

const ctx = { teamId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", membership: { id: "m", role: "responsable" as const } }
const evenement = (nom: string, donnees: unknown) => ({ id: "e", nom, version: 1, appEmettrice: nom.split(".")[0], donnees })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.prisma.coreTask.findFirst.mockResolvedValue(null)
  mocks.prisma.coreAction.findFirst.mockResolvedValue(null)
})

describe("partenaires.relance_due : le socle crée la tâche de relance", () => {
  const relance = { partnerId: "33333333-3333-4333-8333-333333333333", partenaireNom: "Garage Muller", date: "2026-11-05", suiviParPersonId: "44444444-4444-4444-8444-444444444444" }

  it("crée une tâche à faire, assignée au suivi, datée de la relance", async () => {
    const gestionnaire = trouverGestionnaire("core", "partenaires.relance_due")
    expect(gestionnaire).toBeDefined()
    await gestionnaire!(ctx, evenement("partenaires.relance_due", relance))
    expect(mocks.tx.coreTask.create).toHaveBeenCalledTimes(1)
    const donnees = mocks.tx.coreTask.create.mock.calls[0][0].data as Record<string, unknown>
    expect(donnees).toMatchObject({
      app: "partenaires",
      ficheType: "partner",
      ficheId: relance.partnerId,
      titre: "Relancer Garage Muller",
      assigneePersonId: relance.suiviParPersonId,
      statut: "a_faire",
    })
    expect(donnees.echeance).toEqual(new Date("2026-11-05T00:00:00Z"))
  })

  it("ne double pas une tâche déjà à faire pour la même fiche", async () => {
    mocks.prisma.coreTask.findFirst.mockResolvedValueOnce({ id: "existante" })
    await trouverGestionnaire("core", "partenaires.relance_due")!(ctx, evenement("partenaires.relance_due", relance))
    expect(mocks.tx.coreTask.create).not.toHaveBeenCalled()
  })

  it("ignore une charge mal formée sans rien écrire", async () => {
    await trouverGestionnaire("core", "partenaires.relance_due")!(ctx, evenement("partenaires.relance_due", { partnerId: "x" }))
    expect(mocks.tx.coreTask.create).not.toHaveBeenCalled()
  })
})

describe("levée d'une action : une action « tache_ » termine la tâche qu'elle porte", () => {
  const levee = (cleUnicite: string) => trouverGestionnaire("core", "checklist.action_levee")!(ctx, evenement("checklist.action_levee", { cleUnicite }))

  it("termine les tâches à faire de la fiche d'une action tache_probleme", async () => {
    mocks.prisma.coreAction.findFirst.mockResolvedValueOnce({ type: "tache_probleme", appOrigine: "checklist", ficheType: "point", ficheId: "p1" })
    await levee("tache_point:p1")
    expect(mocks.prisma.coreAction.updateMany).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.coreTask.updateMany).toHaveBeenCalledTimes(1)
    const envoi = mocks.prisma.coreTask.updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> }
    expect(envoi.where).toMatchObject({ app: "checklist", ficheType: "point", ficheId: "p1", statut: "a_faire" })
    expect(envoi.data).toMatchObject({ statut: "fait" })
  })

  it("une action point_critique levée sur le même point ne ferme pas la tâche", async () => {
    mocks.prisma.coreAction.findFirst.mockResolvedValueOnce({ type: "point_critique", appOrigine: "checklist", ficheType: "point", ficheId: "p1" })
    await levee("point_critique:p1")
    expect(mocks.prisma.coreTask.updateMany).not.toHaveBeenCalled()
  })

  it("sans action en attente, ne touche à aucune tâche", async () => {
    await levee("tache_point:p9")
    expect(mocks.prisma.coreTask.updateMany).not.toHaveBeenCalled()
  })
})

describe("garde-fou : aucune app n'écrit core_task", () => {
  const racine = path.resolve(__dirname, "../../apps")
  const ECRITURE = /coreTask\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/

  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = path.join(dossier, nom)
      if (statSync(chemin).isDirectory()) return fichiers(chemin)
      return nom.endsWith(".ts") && !nom.endsWith(".test.ts") ? [chemin] : []
    })
  }

  it("aucun fichier de src/apps ne contient une écriture sur coreTask", () => {
    const fautifs = fichiers(racine).filter((chemin) => ECRITURE.test(readFileSync(chemin, "utf8")))
    expect(fautifs.map((chemin) => path.relative(racine, chemin))).toEqual([])
  })
})
