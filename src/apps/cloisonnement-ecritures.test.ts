// Écritures croisées (brief 3.8, §9) : une app n'appelle jamais le client Prisma sur une table d'une autre app.
// Voiture, Budget et Partenaires écrivent leurs tables, et lisent les autres par leurs lectures partagées.
// Ce test lit le code source : un appel du type tx.voitureSlot.update(...) dans src/apps/partenaires/ échoue.
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const APPS = ["budget", "partenaires", "voiture", "saison"] as const
const OPERATIONS = "find(?:First|Unique|Many)|create(?:Many)?|update(?:Many)?|upsert|delete(?:Many)?|count|aggregate|groupBy"

function fichiersDe(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiersDe(chemin)
    return nom.endsWith(".ts") || nom.endsWith(".tsx") ? [chemin] : []
  })
}

// Accès Prisma à une table d'une autre app : tx.voitureSlot.findMany, prismaPourTeam(...).budgetIncome.create, etc.
function ecrituresCroisees(app: string, source: string): string[] {
  const autres = APPS.filter((autre) => autre !== app).join("|")
  const motif = new RegExp(`\\.(${autres})[A-Z][A-Za-z]*\\.(${OPERATIONS})\\(`)
  return source
    .split("\n")
    .map((ligne, index) => ({ ligne, numero: index + 1 }))
    .filter(({ ligne }) => !ligne.trim().startsWith("//") && motif.test(ligne))
    .map(({ ligne, numero }) => `${numero}: ${ligne.trim()}`)
}

describe("écritures croisées entre apps", () => {
  for (const app of APPS) {
    it(`${app} n'accède pas aux tables des autres apps`, () => {
      const dossier = path.join(process.cwd(), "src", "apps", app)
      const trouvees = fichiersDe(dossier).flatMap((fichier) =>
        ecrituresCroisees(app, readFileSync(fichier, "utf-8")).map((ligne) => `${path.relative(process.cwd(), fichier)}:${ligne}`),
      )
      expect(trouvees).toEqual([])
    })
  }
})
