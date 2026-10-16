// Contrôle statique des conventions de prisma/schema.prisma. Prisma ne sait pas
// factoriser les colonnes communes : ce module lit le texte du schéma et renvoie
// la liste des écarts. Voir docs/conventions-schema.md.

// Modèles sans aucun bloc commun : référentiels globaux (cf. docs/conventions-schema.md).
const MODELES_SANS_BLOC = ["CoreApp", "CoreRoleDefault"]

// Modèles avec le bloc commun, mais sans team_id : ils appartiennent à un compte,
// pas à une team. CoreUser, CoreAuthToken et CoreDevice.
const MODELES_SANS_TEAM = ["CoreUser", "CoreAuthToken", "CoreDevice"]

// Types scalaires Prisma : une ligne dont le type n'est pas l'un d'eux est une
// relation (type = modèle) ou un enum. Seuls les scalaires en camelCase exigent un @map.
const TYPES_SCALAIRES = ["String", "Int", "Boolean", "DateTime", "Json", "Float", "BigInt", "Decimal", "Bytes"]

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
    if (MODELES_SANS_BLOC.includes(modele)) {
      // Référentiel : seulement le nom de table snake_case.
      if (!corps.includes(`@@map("${nomDeTable(modele)}")`)) {
        erreurs.push(`${modele} : @@map("${nomDeTable(modele)}") absent`)
      }
      continue
    }

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

    const porteTeam = /^\s+teamId\s/m.test(corps)
    if (modele === "CoreTeam" || MODELES_SANS_TEAM.includes(modele)) {
      if (porteTeam) erreurs.push(`${modele} : ne doit pas porter team_id`)
    } else {
      if (!/^\s+teamId\s+String\s+@map\("team_id"\)\s+@db\.Uuid/m.test(corps)) {
        erreurs.push(`${modele} : team_id String @map("team_id") @db.Uuid absent`)
      }
      if (!corps.includes("@@index([teamId])")) {
        erreurs.push(`${modele} : @@index([teamId]) absent`)
      }
    }

    // Tout champ scalaire en camelCase doit porter un @map vers sa colonne snake_case.
    // Les relations (type = modèle) et les enums n'ont pas de colonne : ignorés.
    for (const [, champ, ligne] of Array.from(corps.matchAll(/^\s+([A-Za-z]\w*)\s+([^\n]*)$/gm))) {
      const type = ligne.trim().split(/\s+/)[0]
      if (!TYPES_SCALAIRES.includes(type.replace(/\?|\[\]$/g, ""))) continue
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
