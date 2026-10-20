// Dossier des fichiers (logos, pièces jointes, exports). En production, c'est le point de
// montage du volume Coolify ; en développement, un dossier ignoré par Git. Utilisé par le service
// des fichiers (src/core/fichiers/, tâche 3.1) : écriture et lecture passent par lui.

export function dossierStockage(env: { STOCKAGE_DIR?: string; NODE_ENV?: string } = process.env): string {
  if (env.STOCKAGE_DIR && env.STOCKAGE_DIR.trim() !== "") return env.STOCKAGE_DIR.trim()
  return env.NODE_ENV === "production" ? "/app/stockage" : "./stockage"
}
