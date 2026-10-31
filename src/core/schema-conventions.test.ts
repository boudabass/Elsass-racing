import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { MODELES_TEAM_OPTIONNEL, verifierConventions } from "./schema-conventions"

// Fins de ligne normalisées : le schéma est commité en CRLF, et la regex du dernier test
// ne traverse pas un \r.
const schema = readFileSync(
  fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n")

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

  it("le schéma porte les onze tables de Partenaires", () => {
    const modeles = Array.from(schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm), ([, corps]) => corps)
    const tables = modeles.map((corps) => corps.match(/@@map\("(partenaires_\w+)"\)/)?.[1]).filter((nom) => nom !== undefined)
    expect(tables.sort()).toEqual([
      "partenaires_agreement",
      "partenaires_amendment",
      "partenaires_benefit",
      "partenaires_benefit_catalog",
      "partenaires_interaction",
      "partenaires_partner",
      "partenaires_portal_link",
      "partenaires_portal_message",
      "partenaires_proof",
      "partenaires_report",
      "partenaires_template",
    ])
  })

  it("l'exception team_id vide ne couvre que les trois modèles fournis de Check-lists", () => {
    expect([...MODELES_TEAM_OPTIONNEL].sort()).toEqual(["ChecklistTemplate", "ChecklistTemplateItem", "ChecklistTemplateSection"])
  })

  it("signale un team_id vide hors de l'exception", () => {
    const equipeSansTeam = schema.replace(/(model EquipeLicence \{[\s\S]*?)teamId(\s+)String(\s+)@map/, "$1teamId$2String?$3@map")
    expect(equipeSansTeam).not.toBe(schema)
    expect(verifierConventions(equipeSansTeam)).toContain('EquipeLicence : team_id String @map("team_id") @db.Uuid absent')
  })

  it("signale un team_id non vide sur un modèle fourni", () => {
    const modeleAvecTeam = schema.replace(/(model ChecklistTemplate \{[\s\S]*?)teamId(\s+)String\?/, "$1teamId$2String")
    expect(modeleAvecTeam).not.toBe(schema)
    expect(verifierConventions(modeleAvecTeam)).toContain(
      'ChecklistTemplate : team_id String? @map("team_id") @db.Uuid attendu (modèle fourni, exception)',
    )
  })

  it("core_team porte les trois colonnes d'identité juridique", () => {
    const equipe = schema.match(/^model CoreTeam \{([\s\S]*?)^\}/m)?.[1] ?? ""
    expect(equipe).toMatch(/^\s+formeJuridique\s+String\?\s+@map\("forme_juridique"\)/m)
    expect(equipe).toMatch(/^\s+signataireNom\s+String\?\s+@map\("signataire_nom"\)/m)
    expect(equipe).toMatch(/^\s+signataireQualite\s+String\?\s+@map\("signataire_qualite"\)/m)
  })
})
