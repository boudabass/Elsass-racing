import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { LigneSynchro, Operation, ResultatOperation } from "../protocole"

import { ouvrirBase } from "./base"
import { ETAT_INITIAL, MoteurSynchro } from "./moteur"

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
  it("une modification écrite pendant l'envoi d'une autre n'est pas fondue : refusée la première, la seconde reste en file", async () => {
    const { moteur } = nouveauMoteur()
    serveur.lignes.core_note = [ligne("note-1", { texte: "Ancien" })]
    await moteur.synchroniser()

    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-1", champs: { texte: "Premier" } })
    // Pendant que « Premier » part, une seconde modification de la même ligne est écrite : elle est en vol ailleurs, donc
    // elle reste une opération à part.
    const fetchSimule = globalThis.fetch
    let dejaFait = false
    vi.stubGlobal("fetch", async (chemin: string, init: RequestInit) => {
      if (chemin === "/api/synchro/pousser" && !dejaFait) {
        dejaFait = true
        await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-1", champs: { texte: "Second" } })
      }
      return fetchSimule(chemin, init)
    })
    // Le serveur ne répond que pour « Premier » : « Second » n'a pas de résultat et reste en file.
    serveur.pousser = (operations) =>
      operations.filter((o) => o.champs?.texte === "Premier").map((o) => ({ idOperation: o.idOperation, statut: "refusee" as const, raison: "Premier refusé." }))
    await moteur.synchroniser()

    const refus = await moteur.lireRefus()
    expect(refus).toHaveLength(1)
    expect(refus[0]).toMatchObject({ idLigne: "note-1", raison: "Premier refusé." })
    expect(moteur.lireEtat().enAttente).toBe(1)
  })
})

describe("moteur : modifications successives hors ligne", () => {
  it("deux modifications d'une même ligne, avant envoi, ne forment qu'une opération, avec la version lue de la première", async () => {
    const { moteur } = nouveauMoteur()
    serveur.lignes.core_note = [ligne("note-m", { texte: "Ancien" }, 3)]
    await moteur.synchroniser()

    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-m", champs: { texte: "Premier" } })
    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-m", champs: { texte: "Second" } })
    const envoyees = capturerEnvois()
    await moteur.synchroniser()

    expect(envoyees.flat()).toEqual([expect.objectContaining({ type: "modifier", id: "note-m", revLue: 3, champs: { texte: "Second" } })])
    // Une seule opération : pas de conflit journalisé.
    expect(envoyees).toHaveLength(1)
  })

  it("une modification écrite pendant l'envoi d'une autre part avec la version qui en résulte, sans faux conflit", async () => {
    const { moteur } = nouveauMoteur()
    serveur.lignes.core_note = [ligne("note-n", { texte: "Ancien" }, 3)]
    await moteur.synchroniser()

    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-n", champs: { texte: "Premier" } })
    const fetchSimule = globalThis.fetch
    let dejaFait = false
    vi.stubGlobal("fetch", async (chemin: string, init: RequestInit) => {
      if (chemin === "/api/synchro/pousser" && !dejaFait) {
        dejaFait = true
        await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-n", champs: { texte: "Pendant l'envoi" } })
      }
      return fetchSimule(chemin, init)
    })
    const envoyees = capturerEnvois()
    await moteur.synchroniser()

    // « Premier » part avec la version 3 et est appliquée (le serveur passe à 4) ; « Pendant l'envoi » part ensuite avec 4.
    expect(envoyees).toHaveLength(2)
    expect(envoyees[0]).toEqual([expect.objectContaining({ type: "modifier", revLue: 3 })])
    expect(envoyees[1]).toEqual([expect.objectContaining({ type: "modifier", revLue: 4, champs: { texte: "Pendant l'envoi" } })])
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

describe("moteur : instantané serveur", () => {
  // Le hook rend ETAT_INITIAL pendant l'hydratation : l'état d'un moteur neuf doit être exactement cette valeur, et une
  // synchro ne doit jamais la modifier (sinon le serveur et le client ne rendent plus la même chose).
  it("l'état d'un moteur neuf égale ETAT_INITIAL, et une synchro ne modifie pas la constante", async () => {
    const { moteur } = nouveauMoteur()
    expect(moteur.lireEtat()).toEqual(ETAT_INITIAL)

    const avant = { ...ETAT_INITIAL }
    await moteur.ecrireLocal("core_note", { type: "creer", id: "note-3", champs: { texte: "Une note" } })
    await moteur.synchroniser()
    expect(moteur.lireEtat().derniereSync).not.toBeNull()
    expect(ETAT_INITIAL).toEqual(avant)
  })
})

// Chaque poussée reçue par le serveur simulé : une liste d'opérations par envoi.
function capturerEnvois(): Operation[][] {
  const envoyees: Operation[][] = []
  serveur.pousser = (operations) => {
    envoyees.push(operations)
    return operations.map((o) => ({ idOperation: o.idOperation, statut: "appliquee" as const }))
  }
  return envoyees
}

describe("moteur : une création puis une modification avant l'envoi", () => {
  it("une seule opération part, avec les champs fondus dans la création", async () => {
    const { moteur } = nouveauMoteur()
    const envoyees = capturerEnvois()
    await moteur.ecrireLocal("core_note", { type: "creer", id: "note-f", champs: { texte: "Brouillon" } })
    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-f", champs: { texte: "Version finale" } })
    await moteur.synchroniser()

    expect(envoyees.flat()).toEqual([expect.objectContaining({ type: "creer", id: "note-f", champs: { texte: "Version finale" } })])
    expect(moteur.lireEtat().enAttente).toBe(0)
  })

  it("une création puis une suppression : rien ne part, et la ligne disparaît de l'écran", async () => {
    const { moteur } = nouveauMoteur()
    const envoyees = capturerEnvois()
    await moteur.ecrireLocal("core_note", { type: "creer", id: "note-s", champs: { texte: "Jamais envoyée" } })
    await moteur.ecrireLocal("core_note", { type: "supprimer", id: "note-s" })

    expect(await moteur.lireTable("core_note")).toEqual([])
    expect(moteur.lireEtat().enAttente).toBe(0)
    await moteur.synchroniser()
    expect(envoyees.flat()).toEqual([])
  })

  it("une création appliquée, puis une modification avant le tirage : part avec revLue 1", async () => {
    const { moteur } = nouveauMoteur()
    const envoyees = capturerEnvois()
    await moteur.ecrireLocal("core_note", { type: "creer", id: "note-c", champs: { texte: "Créée" } })
    await moteur.synchroniser()
    expect((await moteur.lireTable("core_note"))[0]?.rev).toBe(1)

    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-c", champs: { texte: "Modifiée" } })
    await moteur.synchroniser()
    expect(envoyees[1]).toEqual([expect.objectContaining({ type: "modifier", id: "note-c", revLue: 1 })])
  })

  it("une modification faite pendant l'envoi de la création part à part, avec revLue 1", async () => {
    const { moteur } = nouveauMoteur()
    const envoyees = capturerEnvois()
    const fetchSimule = globalThis.fetch
    let dejaFait = false
    // Au moment où la création part, une modification de la même ligne est écrite : elle ne doit pas se fondre dans
    // la création en vol.
    vi.stubGlobal("fetch", async (chemin: string, init: RequestInit) => {
      if (chemin === "/api/synchro/pousser" && !dejaFait) {
        dejaFait = true
        await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-v", champs: { texte: "Pendant l'envoi" } })
      }
      return fetchSimule(chemin, init)
    })
    await moteur.ecrireLocal("core_note", { type: "creer", id: "note-v", champs: { texte: "Avant" } })
    await moteur.synchroniser()

    expect(envoyees).toHaveLength(2)
    expect(envoyees[0]).toEqual([expect.objectContaining({ type: "creer", id: "note-v", champs: { texte: "Avant" } })])
    expect(envoyees[1]).toEqual([expect.objectContaining({ type: "modifier", id: "note-v", revLue: 1, champs: { texte: "Pendant l'envoi" } })])
    expect((await moteur.lireTable("core_note"))[0]?.texte).toBe("Pendant l'envoi")
  })
})

describe("moteur : une ligne en rev 0 sans création en attente", () => {
  it("la modification part avec revLue 1, jamais 0, et l'anomalie est signalée en développement", async () => {
    const { moteur, userId, teamId } = nouveauMoteur()
    const envoyees = capturerEnvois()
    const db = await ouvrirBase(userId, teamId)
    await db.put("core_note", ligne("note-orpheline", { texte: "Sans création" }, 0))
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {})

    await moteur.ecrireLocal("core_note", { type: "modifier", id: "note-orpheline", champs: { texte: "Modifiée" } })
    await moteur.synchroniser()

    expect(envoyees.flat()).toEqual([expect.objectContaining({ type: "modifier", id: "note-orpheline", revLue: 1 })])
    expect(erreurs).toHaveBeenCalled()
    erreurs.mockRestore()
  })
})
