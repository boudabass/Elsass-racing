import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

// Règle d'interface (brief 3.13b, phase B) : rien ne se déplie dans la page. Un formulaire ou un choix s'ouvre dans
// un tiroir (Tiroir, TiroirFormulaire, TiroirAction) ; un formulaire qui occupe sa page passe par FormulairePage.
// Ce test lit les sources et refuse les blocs repliables. Une exception s'ajoute ici, avec sa raison écrite.
const RACINE = join(process.cwd(), "src")

const EXCEPTIONS: Record<string, string> = {}

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return sources(chemin)
    return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : []
  })
}

describe("interface : rien ne se déplie dans la page", () => {
  it("aucun bloc <details> ni <summary> dans les sources", () => {
    const fautifs = sources(RACINE)
      .map((chemin) => relative(process.cwd(), chemin).replaceAll("\\", "/"))
      .filter((chemin) => !(chemin in EXCEPTIONS))
      .filter((chemin) => /<(details|summary)[\s>]/.test(readFileSync(join(process.cwd(), chemin), "utf8")))

    expect(fautifs).toEqual([])
  })
})
