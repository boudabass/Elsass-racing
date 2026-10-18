// Titres de groupe (brief 3.9, §2) : chaque type levé par une app a son libellé, au singulier et au pluriel.
// Ce test lit le code source : un « *.action_requise » qui lève un type sans libellé fait échouer la suite.
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import type { ActionBoite } from "./filtrage"
import { grouperActions, LIBELLES_TYPES } from "./regroupement"

// Type passé par une variable (« type: rappel.type ») : son union est lue dans le fichier indiqué.
const TYPES_PAR_VARIABLE: Record<string, { fichier: string; union: string }> = {
  "rappel.type": { fichier: path.join("src", "apps", "saison", "rappels.ts"), union: "TypeRappel" },
}

function fichiersDe(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiersDe(chemin)
    const source = nom.endsWith(".ts") || nom.endsWith(".tsx")
    return source && !nom.includes(".test.") ? [chemin] : []
  })
}

// Émission : le nom « app.action_requise » (littéral), puis le champ type dans les 400 caractères qui suivent.
const EMISSION = /"[a-z]+\.action_requise"/g
const CHAMP_TYPE = /\btype: ("[a-z_]+"|[a-zA-Z_.]+)/

function jetonsDeTypes(source: string): string[] {
  const jetons: string[] = []
  for (const emission of Array.from(source.matchAll(EMISSION))) {
    const suite = source.slice(emission.index ?? 0, (emission.index ?? 0) + 400)
    const champ = CHAMP_TYPE.exec(suite)
    if (champ) jetons.push(champ[1])
  }
  return jetons
}

// Types réels d'un jeton : un littéral, ou les valeurs de l'union déclarée pour une variable connue.
function typesDuJeton(jeton: string): string[] {
  if (jeton.startsWith('"')) return [jeton.slice(1, -1)]
  const variable = TYPES_PAR_VARIABLE[jeton]
  if (!variable) return [`variable inconnue : ${jeton}`]
  const declaration = readFileSync(variable.fichier, "utf-8").match(new RegExp(`export type ${variable.union} = ([^\\n]+)`))
  return Array.from(declaration?.[1].matchAll(/"([a-z_]+)"/g) ?? [], (m) => m[1])
}

function action(type: string, cle: string): ActionBoite {
  return { id: cle, appOrigine: "budget", type, cleUnicite: cle, titre: "Titre", cleRegroupement: "groupe" } as ActionBoite
}

describe("titres de groupe de la boîte d'actions", () => {
  it("chaque type levé par un « *.action_requise » dans src/ a un libellé", () => {
    const levés = new Set<string>()
    for (const fichier of fichiersDe(path.join(process.cwd(), "src"))) {
      for (const jeton of jetonsDeTypes(readFileSync(fichier, "utf-8"))) {
        typesDuJeton(jeton).forEach((type) => levés.add(type))
      }
    }
    // Garde-fou : si l'analyse ne trouve plus les émissions, le test ne doit pas passer à vide.
    expect(levés.size).toBeGreaterThan(10)
    expect(Array.from(levés).filter((type) => !LIBELLES_TYPES[type])).toEqual([])
  })

  it("chaque libellé a un singulier et un pluriel, et ils diffèrent", () => {
    for (const [type, libelle] of Object.entries(LIBELLES_TYPES)) {
      expect(libelle.singulier, type).not.toBe("")
      expect(libelle.pluriel, type).not.toBe(libelle.singulier)
    }
  })

  it("donne le titre au pluriel pour un groupe de deux", () => {
    const cas: Array<[string, string]> = [
      ["mouvement_a_confirmer", "2 mouvements à confirmer"],
      ["reserver_emplacement", "2 emplacements à réserver"],
      ["preuve_pose", "2 preuves de pose à ajouter"],
      ["message_partenaire", "2 messages de partenaires"],
    ]
    for (const [type, titre] of cas) {
      expect(grouperActions([action(type, "a"), action(type, "b")])[0].titreGroupe).toBe(titre)
    }
  })
})
