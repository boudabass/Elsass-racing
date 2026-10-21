import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { LigneSynchro, Operation, ResultatOperation } from "../protocole"

import { ouvrirBase } from "./base"
import { MoteurSynchro } from "./moteur"

// Le moteur sur une vraie base locale (IndexedDB, fake-indexeddb) et un serveur simulé par un fetch : on vérifie ce qui
// reste sur l'écran, ce qui est gardé en refus, et ce que le tirage suivant rétablit. Les timers ne sont pas avancés :
// aucune synchro ne part toute seule pendant un test.

interface ServeurSimule {
  // Lignes du serveur, par table, rendues au tirage.
  lignes: Record<string, LigneSynchro[]>
  // Réponse à une poussée : par défaut, tout est appliqué.
  pousser: (operations: Operation[]) => ResultatOperation[]
  // Curseurs demandés à chaque tirage, pour vérifier la remise à zéro.
  tirages: Array<Record<string, string | null>>
}

let serveur: ServeurSimule
let compteur = 0

const MAINTENANT = "2026-10-21T09:00:00.000Z"
const VEHICULE = "0190a7c2-0000-7000-8000-000000000001"
const ORGANE = "0190a7c2-0000-7000-8000-000000000002"

function ligne(id: string, champs: Record<string, unknown>, rev = 1): LigneSynchro {
  return { id, rev, createdAt: MAINTENANT, updatedAt: MAINTENANT, deletedAt: null, createdBy: "auteur", updatedBy: "auteur", ...champs }
}

function reponseJson(corps: unknown): Response {
  return new Response(JSON.stringify(corps), { status: 200, headers: { "Content-Type": "application/json" } })
}

function installerServeur(): void {
  serveur = {
    lignes: {},
    pousser: (operations) => operations.map((o) => ({ idOperation: o.idOperation, statut: "appliquee" as const })),
    tirages: [],
  }
  vi.stubGlobal("navigator", { onLine: true })
  vi.stubGlobal("fetch", async (chemin: string, init: RequestInit) => {
    const corps = JSON.parse(String(init.body))
    if (chemin === "/api/synchro/pousser") return reponseJson({ resultats: serveur.pousser(corps.operations) })
    serveur.tirages.push(corps.curseurs)
    const tables: Record<string, unknown> = {}
    for (const table of Object.keys(corps.curseurs)) {
      tables[table] = { lignes: serveur.lignes[table] ?? [], curseur: `curseur-${serveur.tirages.length}`, suite: false }
    }
    return reponseJson({ tables, horodatage: MAINTENANT })
  })
}

// Un compte et une team neufs pour chaque test : la base locale de chacun est séparée.
function nouveauMoteur(): { moteur: MoteurSynchro; userId: string; teamId: string } {
  compteur += 1
  const userId = `compte-${compteur}`
  const teamId = `team-${compteur}`
  return { moteur: new MoteurSynchro(userId, teamId), userId, teamId }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  installerServeur()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("moteur : une création refusée", () => {
  it("sort de l'écran et reste en refus, avec la raison du serveur", async () => {
    const { moteur } = nouveauMoteur()
    await moteur.ecrireLocal("garage_work_order", {
      type: "creer",
      id: "ordre-1",
      champs: { vehicleId: VEHICULE, vehicleComponentId: ORGANE, titre: "Plaquettes avant" },
    })
    expect((await moteur.lireTable("garage_work_order")).map((l) => l.id)).toEqual(["ordre-1"])

    serveur.pousser = (operations) => operations.map((o) => ({ idOperation: o.idOperation, statut: "refusee" as const, raison: "Pas de fiche personne." }))
    await moteur.synchroniser()

    expect(await moteur.lireTable("garage_work_order")).toEqual([])
    const refus = await moteur.lireRefus()
    expect(refus).toHaveLength(1)
    expect(refus[0]).toMatchObject({
      table: "garage_work_order",
      idLigne: "ordre-1",
      type: "creer",
      libelle: "Intervention",
      resume: "Plaquettes avant",
      raison: "Pas de fiche personne.",
    })
    expect(moteur.lireEtat().refus).toBe(1)
  })
})

describe("moteur : une modification refusée", () => {
  it("remet la table à relire : la ligne reprend la valeur du serveur au tirage suivant", async () => {
    const { moteur } = nouveauMoteur()
    serveur.lignes.core_note = [ligne("note-1", { texte: "Ancien" })]
    await moteur.synchroniser()
    expect((await moteur.lireTable("core_note"))[0]?.texte).toBe("Ancien")

    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-1", champs: { texte: "Nouveau" } })
    expect((await moteur.lireTable("core_note"))[0]?.texte).toBe("Nouveau")

    serveur.pousser = (operations) => operations.map((o) => ({ idOperation: o.idOperation, statut: "refusee" as const, raison: "Texte refusé." }))
    const tiragesAvant = serveur.tirages.length
    await moteur.synchroniser()

    // Le tirage qui suit le refus repart du début de la table, au lieu de son curseur.
    const tiragesApres = serveur.tirages.slice(tiragesAvant)
    expect(tiragesApres.some((curseurs) => curseurs.core_note === null)).toBe(true)
    // La valeur locale fantôme disparaît : la ligne est celle du serveur, et le refus est gardé.
    const note = (await moteur.lireTable("core_note"))[0]
    expect(note?.texte).toBe("Ancien")
    expect(note?.enAttente).toBeFalsy()
    const refus = await moteur.lireRefus()
    expect(refus).toHaveLength(1)
    expect(refus[0]).toMatchObject({ type: "modifier", idLigne: "note-1", raison: "Texte refusé." })
  })
})

describe("moteur : une autre opération reste sur la ligne", () => {
  it("garde le refus, et l'opération restante reste dans la file", async () => {
    const { moteur } = nouveauMoteur()
    serveur.lignes.core_note = [ligne("note-1", { texte: "Ancien" })]
    await moteur.synchroniser()

    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-1", champs: { texte: "Premier" } })
    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-1", champs: { texte: "Second" } })

    // Le serveur ne répond que pour la première opération : la seconde reste en file.
    serveur.pousser = (operations) => [{ idOperation: operations[0]!.idOperation, statut: "refusee" as const, raison: "Premier refusé." }]
    await moteur.synchroniser()

    const refus = await moteur.lireRefus()
    expect(refus).toHaveLength(1)
    expect(refus[0]).toMatchObject({ idLigne: "note-1", raison: "Premier refusé." })
    expect(moteur.lireEtat().enAttente).toBe(1)
  })
})

describe("moteur : qui voit les refus", () => {
  it("un refus d'un autre compte ou d'une autre team n'est jamais lu", async () => {
    const { moteur, userId, teamId } = nouveauMoteur()
    const db = await ouvrirBase(userId, teamId)
    const base = { table: "core_note", idLigne: "n", type: "creer" as const, libelle: "Note", resume: null, raison: "x", creeLe: MAINTENANT, refuseLe: MAINTENANT }
    await db.put("refus_synchro", { ...base, idOperation: "d-autre-team", teamId: "autre-team", userId })
    await db.put("refus_synchro", { ...base, idOperation: "d-autre-compte", teamId, userId: "autre-compte" })
    await db.put("refus_synchro", { ...base, idOperation: "d-ce-compte", teamId, userId })

    expect((await moteur.lireRefus()).map((r) => r.idOperation)).toEqual(["d-ce-compte"])
  })
})

describe("moteur : « Compris »", () => {
  it("reste gardé pour un second moteur sur la même base, et « Compris » l'efface pour tous", async () => {
    const { moteur, userId, teamId } = nouveauMoteur()
    await moteur.ecrireLocal("core_note", { type: "creer", id: "note-2", champs: { texte: "Une note" } })
    serveur.pousser = (operations) => operations.map((o) => ({ idOperation: o.idOperation, statut: "refusee" as const, raison: "Refusée." }))
    await moteur.synchroniser()
    const [refus] = await moteur.lireRefus()
    expect(refus).toBeDefined()

    // Un nouveau moteur sur la même base : le refus est toujours là.
    const apresRechargement = new MoteurSynchro(userId, teamId)
    expect(await apresRechargement.lireRefus()).toHaveLength(1)

    await apresRechargement.effacerRefus(refus!.idOperation)
    expect(await apresRechargement.lireRefus()).toEqual([])
    expect(apresRechargement.lireEtat().refus).toBe(0)
  })
})
