import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

// actions.ts est une Server Action : chaque export devient un point d'entrée HTTP. Les fonctions
// …Dans(ctx, …) prennent le contexte en paramètre et ne doivent jamais être exposées.
describe("actions de Saison", () => {
  const source = readFileSync(join(__dirname, "actions.ts"), "utf8")

  it("le fichier est une Server Action", () => {
    expect(source.trimStart().startsWith('"use server"')).toBe(true)
  })

  it("n'exporte aucune fonction dont le nom finit par Dans", () => {
    const exportes = Array.from(source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g), (m) => m[1])
    expect(exportes.length).toBeGreaterThan(0)
    expect(exportes.filter((nom) => nom.endsWith("Dans"))).toEqual([])
  })
})
