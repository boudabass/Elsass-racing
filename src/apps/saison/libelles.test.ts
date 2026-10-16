import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  LIBELLE_INDICE,
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_POINT_PREPARATION,
  LIBELLE_ROLE,
  LIBELLE_STATUT_ENGAGEMENT,
  LIBELLE_STATUT_EPREUVE,
  LIBELLE_STATUT_POINT,
  LIBELLE_STATUT_RESULTAT,
  LIBELLE_TYPE_DOCUMENT,
  LIBELLE_TYPE_EPREUVE,
  LIBELLE_TYPE_ETAPE,
  LIBELLE_TYPE_PROGRAMME,
  LIBELLE_VALIDATION_RESULTAT,
  libelle,
} from "./libelles"

// Valeurs de chaque énumération Saison, lues dans le schéma : un ajout sans libellé fait échouer ce test.
function valeursDeLEnumeration(schema: string, nom: string): string[] {
  const lignes = schema.split(/\r?\n/)
  const debut = lignes.findIndex((ligne) => ligne.startsWith(`enum ${nom} {`))
  if (debut === -1) throw new Error(`Énumération ${nom} introuvable dans le schéma.`)
  const valeurs: string[] = []
  for (const ligne of lignes.slice(debut + 1)) {
    const texte = ligne.trim()
    if (texte === "}") break
    if (texte === "" || texte.startsWith("@@")) continue
    valeurs.push(texte)
  }
  return valeurs
}

const SCHEMA = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8")

const TABLES_PAR_ENUMERATION: Record<string, Record<string, string>> = {
  SaisonPaiementMode: LIBELLE_MODE_PAIEMENT,
  SaisonReadinessPoint: LIBELLE_POINT_PREPARATION,
  SaisonReadinessStatut: LIBELLE_STATUT_POINT,
  SaisonResultStatut: LIBELLE_STATUT_RESULTAT,
  SaisonResultValidation: LIBELLE_VALIDATION_RESULTAT,
  SaisonStageType: LIBELLE_TYPE_ETAPE,
  SaisonScheduleType: LIBELLE_TYPE_PROGRAMME,
  SaisonGeneratedDocType: LIBELLE_TYPE_DOCUMENT,
}

describe("libellés des énumérations de Saison", () => {
  for (const [nom, table] of Object.entries(TABLES_PAR_ENUMERATION)) {
    it(`${nom} : chaque valeur du schéma a son libellé, et seulement celles-là`, () => {
      const valeurs = valeursDeLEnumeration(SCHEMA, nom)
      expect(valeurs.length).toBeGreaterThan(0)
      expect(Object.keys(table).sort()).toEqual([...valeurs].sort())
      for (const valeur of valeurs) expect(table[valeur]).toMatch(/\S/)
    })
  }

  it("couvre les statuts d'engagement, d'épreuve, de résultat, les types d'épreuve et les rôles", () => {
    expect(Object.keys(LIBELLE_STATUT_ENGAGEMENT)).toHaveLength(7)
    expect(Object.keys(LIBELLE_STATUT_EPREUVE)).toHaveLength(4)
    expect(Object.keys(LIBELLE_TYPE_EPREUVE)).toHaveLength(6)
    expect(Object.keys(LIBELLE_ROLE)).toHaveLength(4)
    expect(Object.keys(LIBELLE_INDICE)).toHaveLength(3)
  })

  it("affiche « Arrivée » et non la valeur brute « arrivee »", () => {
    expect(LIBELLE_STATUT_RESULTAT.arrivee).toBe("Arrivée")
    expect(libelle(LIBELLE_STATUT_RESULTAT, "arrivee")).not.toBe("arrivee")
  })

  it("une valeur inconnue reste lisible sans planter", () => {
    expect(libelle(LIBELLE_MODE_PAIEMENT, "inconnu")).toBe("inconnu")
  })
})
