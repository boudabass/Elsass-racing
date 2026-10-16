// Contrôle statique des conventions de prisma/schema.prisma. Prisma ne sait pas
// factoriser les colonnes communes : ce module lit le texte du schéma et renvoie
// la liste des écarts. Voir docs/conventions-schema.md.

// Modèles qui ne portent pas les colonnes communes (cf. docs/conventions-schema.md).
const MODELES_EXCLUS = ["CoreUser", "CoreApp"]

// Colonnes communes : champ Prisma (camelCase) → colonne en base (snake_case).
const COLONNES_COMMUNES = [
  { champ: "createdAt", colonne: "created_at" },
  { champ: "updatedAt", colonne: "updated_at" },
  { champ: "createdBy", colonne: "created_by" },
  { champ: "updatedBy", colonne: "updated_by" },
  { champ: "deletedAt", colonne: "deleted_at" },
]

// CoreTeam ↔ core_team, PascalCase → snake_case.
export function nomDeTable(modele: string): string {
  return modele.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}

export function verifierConventions(schema: string): string[] {
  const erreurs: string[] = []

  for (const [, modele, corps] of Array.from(schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm))) {
    if (MODELES_EXCLUS.includes(modele)) continue

    const table = nomDeTable(modele)
    if (!corps.includes(`@@map("${table}")`)) {
      erreurs.push(`${modele} : @@map("${table}") absent`)
    }

    if (!/^\s+id\s+String\s+@id\s+@db\.Uuid\b/m.test(corps)) {
      erreurs.push(`${modele} : id String @id @db.Uuid attendu`)
    }

    for (const { champ, colonne } of COLONNES_COMMUNES) {
      const motif = new RegExp(`^\\s+${champ}\\s+.*@map\\("${colonne}"\\)`, "m")
      if (!motif.test(corps)) erreurs.push(`${modele} : colonne ${colonne} absente`)
    }

    if (!/^\s+rev\s+Int\s+@default\(1\)/m.test(corps)) {
      erreurs.push(`${modele} : rev Int @default(1) absent`)
    }

    if (modele === "CoreTeam") {
      if (/^\s+teamId\s/m.test(corps)) erreurs.push(`${modele} : ne doit pas porter team_id`)
    } else {
      if (!/^\s+teamId\s+String\s+@map\("team_id"\)\s+@db\.Uuid/m.test(corps)) {
        erreurs.push(`${modele} : team_id String @map("team_id") @db.Uuid absent`)
      }
      if (!corps.includes("@@index([teamId])")) {
        erreurs.push(`${modele} : @@index([teamId]) absent`)
      }
    }

    // Tout champ en camelCase doit porter un @map vers sa colonne snake_case.
    for (const [, champ, ligne] of Array.from(corps.matchAll(/^\s+([A-Za-z]\w*)\s+([^\n]*)$/gm))) {
      if (/[A-Z]/.test(champ) && !/@map\(/.test(ligne)) {
        erreurs.push(`${modele} : champ ${champ} sans @map`)
      }
    }
  }

  if (/@default\(uuid\(\)\)|@default\(cuid\(\)\)/.test(schema)) {
    erreurs.push("@default(uuid()) ou @default(cuid()) interdit : les id sont générés par newId()")
  }

  return erreurs
}
