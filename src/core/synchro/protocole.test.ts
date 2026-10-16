import { describe, expect, it } from "vitest"

import { resultatDejaNote, schemaOperation, schemaPousser } from "./protocole"

const UUID = "0196f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f"

describe("résultat déjà noté (idempotence)", () => {
  it("renvoie le résultat déjà noté sans rien réappliquer", () => {
    expect(resultatDejaNote(UUID, { statut: "appliquee" })).toEqual({ idOperation: UUID, statut: "appliquee" })
    expect(resultatDejaNote(UUID, { statut: "refusee", raison: "x" })).toEqual({ idOperation: UUID, statut: "refusee", raison: "x" })
  })

  it("traite une valeur stockée illisible comme absente", () => {
    expect(resultatDejaNote(UUID, { statut: "inconnu" })).toBeNull()
    expect(resultatDejaNote(UUID, null)).toBeNull()
  })
})

describe("validation des opérations", () => {
  it("refuse un type inconnu et un identifiant qui n'est pas un UUID", () => {
    expect(schemaOperation.safeParse({ idOperation: UUID, table: "core_note", type: "fusionner", id: UUID }).success).toBe(false)
    expect(schemaOperation.safeParse({ idOperation: "pas-un-uuid", table: "core_note", type: "creer", id: UUID }).success).toBe(false)
  })

  it("accepte un envoi de 200 opérations au plus", () => {
    const unef = { idOperation: UUID, table: "core_note", type: "supprimer", id: UUID, revLue: 1 }
    expect(schemaPousser.safeParse({ operations: Array(200).fill(unef) }).success).toBe(true)
    expect(schemaPousser.safeParse({ operations: Array(201).fill(unef) }).success).toBe(false)
  })
})
