import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { verifierConventions } from "./schema-conventions"

const schema = readFileSync(
  fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)),
  "utf8",
)

describe("conventions de prisma/schema.prisma", () => {
  it("le schéma réel respecte toutes les conventions", () => {
    expect(verifierConventions(schema)).toEqual([])
  })

  it("signale une colonne commune oubliée", () => {
    const sansDeletedAt = schema.replace(/^\s+deletedAt .*\n/m, "")
    expect(sansDeletedAt).not.toBe(schema)
    expect(verifierConventions(sansDeletedAt)).toContain("CoreTeam : colonne deleted_at absente")
  })

  it("signale un champ camelCase sans @map", () => {
    const sansMap = schema.replace(/@map\("association_nom"\)/, "")
    expect(sansMap).not.toBe(schema)
    expect(verifierConventions(sansMap)).toContain("CoreTeam : champ associationNom sans @map")
  })

  it("signale un @default(uuid()) en base", () => {
    const avecDefaut = schema.replace(/@id @db\.Uuid/, "@id @db.Uuid @default(uuid())")
    expect(verifierConventions(avecDefaut).join(" ")).toContain("@default(uuid())")
  })
})
