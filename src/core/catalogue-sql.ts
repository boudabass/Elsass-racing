// SQL du catalogue (apps et droits par défaut) pour une migration. En production, seul
// `prisma migrate deploy` tourne : le seed TypeScript n'est pas dans l'image. Le catalogue
// doit donc aussi passer par une migration. Ce module écrit ce SQL depuis src/core/catalogue.ts ;
// un test vérifie que la dernière migration « _core_catalogue » est exactement ce SQL.

import { APPS, DROITS_PAR_DEFAUT } from "./catalogue"

// Littéral SQL : les apostrophes sont doublées.
function texteSql(valeur: string): string {
  return `'${valeur.replace(/'/g, "''")}'`
}

export function sqlCatalogue(): string {
  const apps = APPS.map((app) => {
    const requiert =
      app.requiert.length === 0 ? "ARRAY[]::text[]" : `ARRAY[${app.requiert.map(texteSql).join(", ")}]::text[]`
    return `  (${[texteSql(app.cle), texteSql(app.nom), texteSql(app.icone), texteSql(app.version), requiert].join(", ")})`
  })

  const droits = DROITS_PAR_DEFAUT.map(
    (droit) => `  (${texteSql(droit.role)}::core_role, ${texteSql(droit.appCle)}, ${texteSql(droit.niveau)}::core_access_level)`,
  )

  return [
    "-- Catalogue des apps et des droits par défaut. Généré par scripts/generer-migration-catalogue.ts",
    "-- depuis src/core/catalogue.ts. Ne pas modifier à la main : si le catalogue change, générer une",
    "-- nouvelle migration « core_catalogue » (voir docs/conventions-schema.md, section Catalogue).",
    "",
    "INSERT INTO core_app (cle, nom, icone, version, requiert) VALUES",
    apps.join(",\n"),
    "ON CONFLICT (cle) DO UPDATE SET nom = EXCLUDED.nom, icone = EXCLUDED.icone, version = EXCLUDED.version, requiert = EXCLUDED.requiert;",
    "",
    "INSERT INTO core_role_default (role, app_cle, niveau) VALUES",
    droits.join(",\n"),
    "ON CONFLICT (role, app_cle) DO UPDATE SET niveau = EXCLUDED.niveau;",
    "",
  ].join("\n")
}
