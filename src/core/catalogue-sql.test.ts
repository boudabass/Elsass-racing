import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { sqlCatalogue } from "./catalogue-sql"

const DOSSIER_MIGRATIONS = fileURLToPath(new URL("../../prisma/migrations", import.meta.url))

describe("sqlCatalogue", () => {
  it("contient les 11 apps et les 44 droits par défaut", () => {
    const sql = sqlCatalogue()
    expect(sql.match(/^ {2}\('/gm)?.length).toBe(11 + 44)
    expect(sql).toContain("ON CONFLICT (cle) DO UPDATE")
    expect(sql).toContain("ON CONFLICT (role, app_cle) DO UPDATE")
  })

  // Si le catalogue change, ce test échoue tant qu'une nouvelle migration n'a pas été générée.
  it("correspond à la dernière migration du catalogue", () => {
    const dossiers = readdirSync(DOSSIER_MIGRATIONS)
      .filter((nom) => nom.endsWith("_core_catalogue"))
      .sort()
    expect(dossiers.length).toBeGreaterThan(0)

    const derniere = dossiers[dossiers.length - 1]
    // Les fins de ligne du fichier sont normalisées : Git peut le rendre en CRLF sous Windows.
    const sqlMigration = readFileSync(join(DOSSIER_MIGRATIONS, derniere, "migration.sql"), "utf8").replace(/\r\n/g, "\n")
    expect(sqlMigration).toBe(sqlCatalogue())
  })
})
