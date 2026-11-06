// Règle 2 de CLAUDE.md : une app ne modifie jamais les tables d'une autre app. `core_task` est écrite par le socle seul
// (src/core/taches/). Ce test lit le code source : un appel du type tx.coreTask.create(...) dans src/apps/ échoue.
// Les apps passent par creerTache, definirStatutTache, retirerTaches, terminerTachesSauf et les gestionnaires du socle.
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const ECRITURES_CORE_TASK = /\.coreTask\.(create|update|updateMany|delete)\(/

function fichiersDe(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiersDe(chemin)
    const sourceTest = nom.endsWith(".test.ts") || nom.endsWith(".test.tsx")
    return (nom.endsWith(".ts") || nom.endsWith(".tsx")) && !sourceTest ? [chemin] : []
  })
}

describe("core_task n'est écrite que par le socle", () => {
  it("aucune app ne crée, ne modifie ni ne supprime une tâche du socle", () => {
    const trouvees = fichiersDe(path.join(process.cwd(), "src", "apps"))
      .flatMap((fichier) =>
        readFileSync(fichier, "utf-8")
          .split("\n")
          .map((ligne, index) => ({ ligne, numero: index + 1 }))
          .filter(({ ligne }) => !ligne.trim().startsWith("//") && ECRITURES_CORE_TASK.test(ligne))
          .map(({ ligne, numero }) => `${path.relative(process.cwd(), fichier)}:${numero}: ${ligne.trim()}`),
      )
    expect(trouvees).toEqual([])
  })
})
