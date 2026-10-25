import { describe, expect, it, vi } from "vitest"

import { toutesLesDeclarations } from "../registre"

// Le registre importe les services serveur : sans base, le client Prisma refuse de se créer. Les déclarations sont
// statiques, donc un faux client suffit pour lire la liste.
vi.mock("@/lib/prisma", () => ({ prisma: {}, prismaPourTeam: () => ({}), executerPourTeam: async () => undefined }))

import { TABLES_LOCALES, type OperationEnAttente } from "./base"
import { LIBELLES_TABLES } from "./libelles"
import { RAISON_PAR_DEFAUT, libelleEnvoisRefuses, refusDepuisOperation, refusDuCompte, type RefusLocal } from "./refus"

const COMPTE = { teamId: "team-1", userId: "compte-1" }

function operation(partiel: Partial<OperationEnAttente> & Pick<OperationEnAttente, "table" | "type">): OperationEnAttente {
  return { idOperation: "op-1", id: "ligne-1", creeeLe: "2026-10-21T09:00:00.000Z", tentatives: 0, ...partiel }
}

describe("refus de la synchro : ce qui est gardé", () => {
  it("une intervention refusée porte son titre, son libellé et la raison du serveur", () => {
    const refus = refusDepuisOperation(
      operation({ table: "garage_work_order", type: "creer", champs: { vehicleId: "v", vehicleComponentId: "o", titre: "Plaquettes avant" } }),
      { idOperation: "op-1", statut: "refusee", raison: "Ton compte n'a pas de fiche personne dans la team." },
      COMPTE,
      "2026-10-21T09:05:00.000Z",
    )
    expect(refus).toMatchObject({
      idOperation: "op-1",
      teamId: "team-1",
      userId: "compte-1",
      table: "garage_work_order",
      idLigne: "ligne-1",
      type: "creer",
      libelle: "Intervention",
      resume: "Plaquettes avant",
      raison: "Ton compte n'a pas de fiche personne dans la team.",
      creeLe: "2026-10-21T09:00:00.000Z",
      refuseLe: "2026-10-21T09:05:00.000Z",
    })
  })

  it("une modification refusée garde son type, pour que la ligne soit relue", () => {
    const refus = refusDepuisOperation(
      operation({ table: "core_note", type: "modifier", champs: { texte: "Nouveau texte" } }),
      { idOperation: "op-1", statut: "refusee", raison: "Cet élément n'existe plus." },
      COMPTE,
      "2026-10-21T09:05:00.000Z",
    )
    expect(refus.type).toBe("modifier")
    expect(refus.resume).toBe("Nouveau texte")
  })

  it("sans raison du serveur, on affiche la phrase de repli, jamais une raison vide", () => {
    for (const raison of [undefined, "", "   "]) {
      const refus = refusDepuisOperation(operation({ table: "core_note", type: "creer", champs: { texte: "x" } }), { idOperation: "op-1", statut: "refusee", raison }, COMPTE, "t")
      expect(refus.raison).toBe(RAISON_PAR_DEFAUT)
    }
  })

  it("rien n'est deviné : sans champ saisi, le résumé est null", () => {
    const sansTexte = refusDepuisOperation(operation({ table: "budget_expense", type: "creer", champs: { montant: 780 } }), { idOperation: "op-1", statut: "refusee", raison: "x" }, COMPTE, "t")
    expect(sansTexte.resume).toBeNull()
    const sansChamps = refusDepuisOperation(operation({ table: "garage_work_order", type: "supprimer" }), { idOperation: "op-1", statut: "refusee", raison: "x" }, COMPTE, "t")
    expect(sansChamps.resume).toBeNull()
  })

  it("une table sans résumé montre son libellé seulement", () => {
    const refus = refusDepuisOperation(operation({ table: "voiture_setup", type: "creer", champs: { vehicleId: "v" } }), { idOperation: "op-1", statut: "refusee", raison: "x" }, COMPTE, "t")
    expect(refus).toMatchObject({ libelle: "Fiche de réglage", resume: null })
  })

  it("un texte trop long est coupé pour l'écran", () => {
    const long = "a".repeat(200)
    const refus = refusDepuisOperation(operation({ table: "core_note", type: "creer", champs: { texte: long } }), { idOperation: "op-1", statut: "refusee", raison: "x" }, COMPTE, "t")
    expect(refus.resume?.length).toBe(80)
    expect(refus.resume?.endsWith("…")).toBe(true)
  })
})

describe("refus de la synchro : qui les voit", () => {
  const refus = (teamId: string, userId: string, refuseLe: string, idOperation: string): RefusLocal => ({
    idOperation,
    teamId,
    userId,
    table: "core_note",
    idLigne: "l",
    type: "creer",
    libelle: "Note",
    resume: null,
    raison: "x",
    creeLe: refuseLe,
    refuseLe,
  })

  it("un compte ne voit que les refus de sa team, et de lui-même, les plus récents d'abord", () => {
    const tous = [
      refus("team-1", "compte-1", "2026-10-21T09:00:00.000Z", "a"),
      refus("team-1", "compte-2", "2026-10-21T10:00:00.000Z", "b"),
      refus("team-2", "compte-1", "2026-10-21T11:00:00.000Z", "c"),
      refus("team-1", "compte-1", "2026-10-21T12:00:00.000Z", "d"),
    ]
    expect(refusDuCompte(tous, COMPTE).map((r) => r.idOperation)).toEqual(["d", "a"])
  })

  it("sans refus pour ce compte, la liste est vide", () => {
    expect(refusDuCompte([refus("team-2", "compte-2", "t", "x")], COMPTE)).toEqual([])
  })
})

describe("refus de la synchro : libellé de l'indicateur", () => {
  it("accorde au singulier et au pluriel", () => {
    expect(libelleEnvoisRefuses(1)).toBe("1 envoi refusé")
    expect(libelleEnvoisRefuses(3)).toBe("3 envois refusés")
  })
})

describe("libellés des tables : couverture du registre", () => {
  it("chaque table synchronisée du client a un libellé, et seulement celles-là", () => {
    expect(Object.keys(LIBELLES_TABLES).sort()).toEqual([...TABLES_LOCALES].sort())
  })

  it("chaque table déclarée au registre serveur a un libellé côté client", () => {
    const declarees = toutesLesDeclarations().map((d) => d.cle)
    const sansLibelle = declarees.filter((cle) => !(cle in LIBELLES_TABLES))
    expect(sansLibelle).toEqual([])
  })
})
