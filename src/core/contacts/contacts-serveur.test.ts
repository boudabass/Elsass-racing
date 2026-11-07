// Contacts du socle (5.8b) : création, réutilisation sans casse, catégorie ajoutée une seule fois, cloisonnement par team.
// Le client est une fausse table core_contact en mémoire : seules les lectures et écritures du service sont simulées.
import { describe, expect, it, vi } from "vitest"

import type { ContexteTeam } from "@/core/contexte"
import { ErreurMetier } from "@/core/sdk/actions-serveur"

import { chercherContact, contactDuChoix, trouverOuCreerContact, type ClientContact } from "./contacts-serveur"

// La lecture (chercherContact) passe par une transaction de la team : on lui donne la fausse table.
const bascule = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  executerPourTeam: async (_teamId: string, _userId: string, requete: (tx: unknown) => Promise<unknown>) => requete(bascule.client),
}))

interface LigneContact {
  id: string
  teamId: string
  nom: string
  categories: string[]
  deletedAt: Date | null
  rev: number
}

function fauxClient(lignes: LigneContact[]) {
  const ecritures = { create: 0, update: 0 }
  const client = {
    coreContact: {
      findMany: async ({ where }: { where: { teamId: string; deletedAt: null } }) =>
        lignes
          .filter((ligne) => ligne.teamId === where.teamId && ligne.deletedAt === null)
          .map((ligne) => ({ id: ligne.id, nom: ligne.nom, categories: [...ligne.categories] })),
      create: async ({ data }: { data: Omit<LigneContact, "deletedAt" | "rev"> & { createdBy: string; updatedBy: string } }) => {
        ecritures.create += 1
        lignes.push({ ...data, deletedAt: null, rev: 1 })
        return data
      },
      update: async ({ where, data }: { where: { id: string }; data: { categories: string[] } }) => {
        ecritures.update += 1
        const ligne = lignes.find((item) => item.id === where.id)
        if (!ligne) throw new Error("ligne absente")
        ligne.categories = data.categories
        ligne.rev += 1
        return ligne
      },
    },
  }
  return { client: client as unknown as ClientContact, ecritures }
}

const ctx = (teamId: string): ContexteTeam => ({ teamId, userId: "user-1", membership: { id: "m-1", role: "responsable" } }) as ContexteTeam

describe("trouverOuCreerContact", () => {
  it("crée un contact de la catégorie demandée, dans la team, avec le nom sans espaces superflus", async () => {
    const lignes: LigneContact[] = []
    const { client, ecritures } = fauxClient(lignes)

    const id = await trouverOuCreerContact(client, ctx("team-a"), { nom: "  ASA   Alsace ", categorie: "asa" })

    expect(ecritures.create).toBe(1)
    expect(lignes).toEqual([
      expect.objectContaining({ id, teamId: "team-a", nom: "ASA Alsace", categories: ["asa"], rev: 1 }),
    ])
  })

  it("réutilise un contact de même nom, sans casse ni espaces de bord, sans rien créer", async () => {
    const lignes: LigneContact[] = [{ id: "c-1", teamId: "team-a", nom: "Garage Muller", categories: ["fournisseur"], deletedAt: null, rev: 3 }]
    const { client, ecritures } = fauxClient(lignes)

    const id = await trouverOuCreerContact(client, ctx("team-a"), { nom: "  garage  MULLER ", categorie: "fournisseur" })

    expect(id).toBe("c-1")
    expect(ecritures).toEqual({ create: 0, update: 0 })
    expect(lignes).toHaveLength(1)
  })

  it("ajoute la catégorie demandée à un contact existant, et une seule fois", async () => {
    const lignes: LigneContact[] = [{ id: "c-1", teamId: "team-a", nom: "Saxo Racing", categories: ["partenaire"], deletedAt: null, rev: 1 }]
    const { client, ecritures } = fauxClient(lignes)

    await trouverOuCreerContact(client, ctx("team-a"), { nom: "Saxo Racing", categorie: "asa" })
    const deuxieme = await trouverOuCreerContact(client, ctx("team-a"), { nom: "Saxo Racing", categorie: "asa" })

    expect(deuxieme).toBe("c-1")
    expect(lignes[0]?.categories).toEqual(["partenaire", "asa"])
    expect(ecritures.update).toBe(1)
    expect(ecritures.create).toBe(0)
  })

  it("ne réutilise pas le contact d'une autre team : le cloisonnement tient", async () => {
    const lignes: LigneContact[] = [{ id: "c-autre", teamId: "team-b", nom: "ASA Alsace", categories: ["asa"], deletedAt: null, rev: 1 }]
    const { client, ecritures } = fauxClient(lignes)

    const id = await trouverOuCreerContact(client, ctx("team-a"), { nom: "ASA Alsace", categorie: "asa" })

    expect(id).not.toBe("c-autre")
    expect(ecritures.create).toBe(1)
    expect(lignes.find((ligne) => ligne.id === "c-autre")?.categories).toEqual(["asa"])
  })

  it("ne réutilise pas un contact supprimé", async () => {
    const lignes: LigneContact[] = [{ id: "c-supprime", teamId: "team-a", nom: "Pneus Ouest", categories: ["fournisseur"], deletedAt: new Date(), rev: 2 }]
    const { client, ecritures } = fauxClient(lignes)

    const id = await trouverOuCreerContact(client, ctx("team-a"), { nom: "Pneus Ouest", categorie: "fournisseur" })

    expect(id).not.toBe("c-supprime")
    expect(ecritures.create).toBe(1)
  })

  it("refuse un nom vide, avec la raison", async () => {
    const { client } = fauxClient([])
    await expect(trouverOuCreerContact(client, ctx("team-a"), { nom: "   ", categorie: "asa" })).rejects.toThrow(ErreurMetier)
    await expect(trouverOuCreerContact(client, ctx("team-a"), { nom: "   ", categorie: "asa" })).rejects.toThrow("Donne un nom.")
  })

  it("refuse un nom de plus de 120 caractères", async () => {
    const { client, ecritures } = fauxClient([])
    const trop = "A".repeat(121)

    await expect(trouverOuCreerContact(client, ctx("team-a"), { nom: trop, categorie: "prestataire" })).rejects.toThrow(
      "Le nom ne doit pas dépasser 120 caractères.",
    )
    expect(ecritures.create).toBe(0)
  })

  it("accepte un nom de 120 caractères", async () => {
    const { client } = fauxClient([])
    const id = await trouverOuCreerContact(client, ctx("team-a"), { nom: "B".repeat(120), categorie: "prestataire" })
    expect(id).toBeTruthy()
  })
})

describe("chercherContact", () => {
  it("renvoie le contact de même nom et ses catégories, sinon null, sans rien écrire", async () => {
    const lignes: LigneContact[] = [{ id: "c-1", teamId: "team-a", nom: "Muller", categories: ["partenaire", "fournisseur"], deletedAt: null, rev: 1 }]
    const { client, ecritures } = fauxClient(lignes)
    bascule.client = client

    expect(await chercherContact(ctx("team-a"), " muller ")).toEqual({ id: "c-1", categories: ["partenaire", "fournisseur"] })
    expect(await chercherContact(ctx("team-a"), "Inconnu")).toBeNull()
    expect(ecritures).toEqual({ create: 0, update: 0 })
  })
})

describe("contactDuChoix", () => {
  it("renvoie le contact choisi, ou null quand l'écran n'en donne aucun", async () => {
    const lignes: LigneContact[] = []
    bascule.client = fauxClient(lignes).client

    expect(await contactDuChoix(ctx("team-a"), { contactId: "c-existant" }, "fournisseur")).toBe("c-existant")
    expect(await contactDuChoix(ctx("team-a"), { contactId: "" }, "fournisseur")).toBeNull()
    expect(await contactDuChoix(ctx("team-a"), { contactId: null, nouveauNom: "   " }, "fournisseur")).toBeNull()
    expect(lignes).toHaveLength(0)
  })

  it("refuse le contact choisi et un nouveau nom à la fois, sans rien créer", async () => {
    const lignes: LigneContact[] = []
    bascule.client = fauxClient(lignes).client

    await expect(contactDuChoix(ctx("team-a"), { contactId: "c-1", nouveauNom: "Pneus Ouest" }, "fournisseur")).rejects.toThrow(
      "Choisis un contact existant ou donne son nouveau nom, pas les deux.",
    )
    expect(lignes).toHaveLength(0)
  })

  it("crée le contact du nouveau nom dans la catégorie de l'écran", async () => {
    const lignes: LigneContact[] = []
    bascule.client = fauxClient(lignes).client

    const id = await contactDuChoix(ctx("team-a"), { contactId: null, nouveauNom: " Pneus  Ouest " }, "fournisseur")

    expect(id).toBeTruthy()
    expect(lignes).toEqual([expect.objectContaining({ id, teamId: "team-a", nom: "Pneus Ouest", categories: ["fournisseur"] })])
  })
})
