import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ContexteTeam } from "@/core/contexte"
import { RefusSynchro } from "@/core/synchro/erreurs"
import { MODIFICATION_GARDEE } from "@/core/synchro/protocole"

import { RAISON_LISTE_FERMEE, RAISON_LISTE_SUPPRIMEE, declarationsChecklistSynchro } from "./synchro-serveur"

// Sans base : les tables sont des faux tx, les services de Check-lists sont remplacés. On vérifie la décision de la table
// (coche gardée ou appliquée, journal, droits de l'assistance, lectures filtrées), pas la base.
const etat = vi.hoisted(() => ({ niveau: "contribution" as string }))

vi.mock("@/core/actions/actions-serveur", () => ({ niveauDe: async () => etat.niveau }))
vi.mock("@/lib/prisma", () => ({ prisma: {}, prismaPourTeam: () => ({}), executerPourTeam: async () => undefined }))
vi.mock("./services-serveur", () => ({
  recalculerListe: vi.fn(async (_tx: unknown, _ctx: unknown, listeId: string) => ({
    liste: { id: listeId, epreuveId: "epreuve-1", echeance: null },
    avant: { avancement: 10, zone: "orange", statut: "en_cours" },
    apres: { avancement: 20, zone: "orange", statut: "en_cours" },
  })),
  emettreApresChangement: vi.fn(async () => undefined),
  levereReassignationSiPlusDePoint: vi.fn(async () => undefined),
}))

const declaration = (cle: string) => {
  const trouvee = declarationsChecklistSynchro.find((d) => d.cle === cle)
  if (!trouvee) throw new Error(`pas de déclaration ${cle}`)
  return trouvee
}

const ctx = (role: string): ContexteTeam => ({ teamId: "team-1", userId: "compte-1", membership: { id: "membre-1", role } }) as unknown as ContexteTeam

const MAINTENANT = new Date("2026-11-01T10:00:00Z")
const il = (minutes: number) => new Date(MAINTENANT.getTime() + minutes * 60_000).toISOString()

function pointAvec(options: { statut?: string; cocheLe?: Date | null; liste?: Record<string, unknown> }) {
  return {
    id: "point-1",
    rev: 2,
    statut: options.statut ?? "a_faire",
    cocheLe: options.cocheLe ?? null,
    critique: false,
    personneId: null,
    createdBy: "compte-1",
    deletedAt: null,
    section: { listeId: "liste-1", liste: { ouverteAssistance: true, deletedAt: null, ...options.liste } },
  }
}

function fauxTx(point: ReturnType<typeof pointAvec> | null) {
  return {
    checklistItem: {
      findFirst: vi.fn(async () => point),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    checklistCheckLog: { create: vi.fn(async () => ({})) },
  }
}

describe("coche hors ligne : la table décide, le journal garde tout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    etat.niveau = "contribution"
    vi.useFakeTimers({ now: MAINTENANT })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("une coche plus récente est appliquée, journalisée hors ligne, et ses effets sont notés", async () => {
    const tx = fauxTx(pointAvec({ cocheLe: new Date(il(-30)) }))
    const meta = { appareilId: "appareil-1", effets: {} as Record<string, unknown> }
    const retour = await declaration("checklist_item").modifier!(tx as never, ctx("assistance"), "point-1", { statut: "fait", cocheLe: il(-5) }, meta)
    expect(retour).toBe(true)
    expect(tx.checklistItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ statut: "fait", cocheParId: "compte-1" }) }))
    expect(tx.checklistCheckLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pointId: "point-1", ancienStatut: "a_faire", nouveauStatut: "fait", horsLigne: true, appareilId: "appareil-1", parId: "compte-1" }),
    })
    expect(meta.effets.checklist).toBeDefined()
  })

  it("une coche plus ancienne que la coche stockée est gardée dans le journal, sans rien changer sur le point", async () => {
    const tx = fauxTx(pointAvec({ statut: "fait", cocheLe: new Date(il(-5)) }))
    const meta = { appareilId: "appareil-1", effets: {} as Record<string, unknown> }
    const retour = await declaration("checklist_item").modifier!(tx as never, ctx("assistance"), "point-1", { statut: "probleme", cocheLe: il(-30) }, meta)
    expect(retour).toBe(MODIFICATION_GARDEE)
    expect(tx.checklistItem.updateMany).not.toHaveBeenCalled()
    expect(tx.checklistCheckLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nouveauStatut: "probleme", horsLigne: true }) })
    expect(meta.effets.checklist).toBeUndefined()
  })

  it("un point qui n'existe plus n'écrit rien (false, la poussée le dit)", async () => {
    const tx = fauxTx(null)
    expect(await declaration("checklist_item").modifier!(tx as never, ctx("assistance"), "point-1", { statut: "fait", cocheLe: il(-5) })).toBe(false)
    expect(tx.checklistCheckLog.create).not.toHaveBeenCalled()
  })

  it("apresApplication émet les effets d'une coche appliquée, une fois, et ne fait rien pour une autre opération", async () => {
    const { emettreApresChangement, levereReassignationSiPlusDePoint } = await import("./services-serveur")
    const effets = {
      checklist: {
        liste: { id: "liste-1", epreuveId: "epreuve-1", echeance: null },
        resultat: { avant: { avancement: 10, zone: "orange", statut: "en_cours" }, apres: { avancement: 20, zone: "orange", statut: "en_cours" } },
        changement: { ancien: "a_faire", nouveau: "fait", critique: false, ajoute: false, pointId: "point-1" },
        personneId: "personne-1",
      },
    }
    await declaration("checklist_item").apresApplication!(ctx("assistance"), "point-1", "modifier", effets)
    expect(emettreApresChangement).toHaveBeenCalledTimes(1)
    expect(levereReassignationSiPlusDePoint).toHaveBeenCalledWith(expect.anything(), "personne-1")
    await declaration("checklist_item").apresApplication!(ctx("assistance"), "point-1", "supprimer", effets)
    expect(emettreApresChangement).toHaveBeenCalledTimes(1)
  })
})

describe("droits de l'assistance à la poussée (règle « controle »)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    etat.niveau = "contribution"
  })

  it("une liste ouverte à l'assistance : pas de raison, la poussée passe", async () => {
    const tx = fauxTx(pointAvec({ liste: { ouverteAssistance: true } }))
    expect(await declaration("checklist_item").controleContribution!(tx as never, ctx("assistance"), "point-1")).toBeNull()
  })

  it("une liste refermée entre-temps : la table donne sa raison", async () => {
    const tx = fauxTx(pointAvec({ liste: { ouverteAssistance: false } }))
    expect(await declaration("checklist_item").controleContribution!(tx as never, ctx("assistance"), "point-1")).toBe(RAISON_LISTE_FERMEE)
  })

  it("une liste supprimée : la raison dit qu'elle n'existe plus", async () => {
    const tx = fauxTx(pointAvec({ liste: { deletedAt: new Date() } }))
    expect(await declaration("checklist_item").controleContribution!(tx as never, ctx("assistance"), "point-1")).toBe(RAISON_LISTE_SUPPRIMEE)
  })

  it("responsable et équipage ne sont pas gênés par une liste fermée à l'assistance", async () => {
    const tx = fauxTx(pointAvec({ liste: { ouverteAssistance: false } }))
    expect(await declaration("checklist_item").controleContribution!(tx as never, ctx("responsable"), "point-1")).toBeNull()
    expect(await declaration("checklist_item").controleContribution!(tx as never, ctx("equipage"), "point-1")).toBeNull()
  })

  it("la création et le retrait hors ligne sont refusés avec leur raison", async () => {
    await expect(declaration("checklist_item").creer(fauxTx(null) as never, ctx("responsable"), "point-2", {})).rejects.toBeInstanceOf(RefusSynchro)
    await expect(declaration("checklist_item").creer(fauxTx(null) as never, ctx("responsable"), "point-2", {})).rejects.toThrow("Ajouter un point se fait en ligne.")
    await expect(declaration("checklist_item").supprimer(fauxTx(null) as never, ctx("responsable"), "point-1")).rejects.toThrow("Retirer un point se fait en ligne.")
  })
})

describe("lectures hors ligne : listes, sections et points filtrés par visibilité", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Faux client : enregistre le filtre demandé et ne rend rien.
  function clientRecueillant() {
    const appels: Record<string, unknown>[] = []
    const rendre = vi.fn(async (args: Record<string, unknown>) => {
      appels.push(args)
      return []
    })
    return {
      appels,
      client: {
        checklistList: { findMany: rendre },
        checklistSection: { findMany: rendre },
        checklistItem: { findMany: rendre },
      } as never,
    }
  }

  it("l'assistance ne reçoit que les listes ouvertes à elle, sans filtre d'auteur", async () => {
    etat.niveau = "contribution"
    const { appels, client } = clientRecueillant()
    await declaration("checklist_item").lirePaquet(client, "team-1", null, 500, "compte-1", ctx("assistance"))
    expect(JSON.stringify(appels[0]?.where)).toContain('"ouverteAssistance":true')
    expect(JSON.stringify(appels[0]?.where)).not.toContain("compte-1")
  })

  it("responsable et équipage reçoivent toutes les listes de la team", async () => {
    etat.niveau = "ecriture"
    const { appels, client } = clientRecueillant()
    await declaration("checklist_list").lirePaquet(client, "team-1", null, 500, null, ctx("equipage"))
    expect(JSON.stringify(appels[0]?.where)).not.toContain("ouverteAssistance")
  })

  it("sans niveau de lecture sur Check-lists, rien ne descend", async () => {
    etat.niveau = "aucun"
    const { appels, client } = clientRecueillant()
    expect(await declaration("checklist_section").lirePaquet(client, "team-1", null, 500, null, ctx("invite"))).toEqual([])
    expect(appels).toHaveLength(0)
  })

  it("les listes et les sections sont en lecture seule : une écriture est refusée par la table", () => {
    for (const cle of ["checklist_list", "checklist_section"]) {
      expect(declaration(cle).lectureSeule).toBe(true)
      expect(() => declaration(cle).modifier!(null as never, ctx("responsable"), "x", {})).toThrow(RefusSynchro)
    }
  })
})
