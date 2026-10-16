import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { LIBELLES_PAR_ENUMERATION, formatEuros, libelle } from "./libelles"
import { cellule, csvMouvements, montantFrancais } from "./csv"

// Valeurs de chaque énumération de Budget, lues dans le schéma : un ajout sans libellé fait échouer ce test.
function valeursDeLEnumeration(schema: string, nom: string): string[] {
  const debut = schema.indexOf(`enum ${nom} {`)
  if (debut < 0) throw new Error(`Énumération introuvable : ${nom}`)
  const fin = schema.indexOf("}", debut)
  return schema
    .slice(debut, fin)
    .split(/\r?\n/)
    .slice(1)
    .map((ligne) => ligne.trim())
    .filter((ligne) => /^[a-z_]+$/.test(ligne))
}

describe("libellés de Budget", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8")

  it.each(Object.keys(LIBELLES_PAR_ENUMERATION))("chaque valeur de %s a son libellé", (nom) => {
    const valeurs = valeursDeLEnumeration(schema, nom)
    const libelles = Object.keys(LIBELLES_PAR_ENUMERATION[nom as keyof typeof LIBELLES_PAR_ENUMERATION])
    expect(valeurs.length).toBeGreaterThan(0)
    expect(libelles.sort()).toEqual([...valeurs].sort())
  })

  it("une valeur inconnue est renvoyée telle quelle, sans planter", () => {
    expect(libelle("BudgetSens", "depense")).toBe("Dépense")
    expect(libelle("BudgetSens", "autre")).toBe("autre")
  })
})

describe("montants", () => {
  it("euros en français, avec le symbole", () => {
    // Intl sépare les milliers par une espace insécable fine : on la ramène à une espace ordinaire.
    const texte = formatEuros(123450).replace(/[  ]/g, " ")
    expect(texte).toBe("1 234,50 €")
  })

  it("export : virgule décimale, deux chiffres après la virgule", () => {
    expect(montantFrancais(1234)).toBe("12,34")
    expect(montantFrancais(5)).toBe("0,05")
    expect(montantFrancais(120_000)).toBe("1200,00")
  })
})

describe("export CSV", () => {
  it("échappe le point-virgule, les guillemets et les retours à la ligne", () => {
    expect(cellule("a;b")).toBe('"a;b"')
    expect(cellule('dit "oui"')).toBe('"dit ""oui"""')
    expect(cellule("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"')
    expect(cellule("simple")).toBe("simple")
  })

  it("commence par un BOM UTF-8 et utilise le point-virgule", () => {
    const csv = csvMouvements([
      { date: "2026-10-17", sens: "Dépense", libelle: "Pneus; avant", categorie: "Pneus", payeur: "Moi", montantCentimes: 45_050, statut: "Confirmée" },
    ])
    expect(csv.startsWith("﻿")).toBe(true)
    const lignes = csv.slice(1).split("\r\n").filter((ligne) => ligne !== "")
    expect(lignes[0]).toBe("Date;Sens;Libellé;Catégorie;Payeur;Montant (€);Statut")
    expect(lignes[1]).toBe('2026-10-17;Dépense;"Pneus; avant";Pneus;Moi;450,50;Confirmée')
  })
})
