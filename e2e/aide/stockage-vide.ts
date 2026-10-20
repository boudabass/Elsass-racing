import { rm } from "node:fs/promises"
import path from "node:path"

// Vide le dossier des fichiers de test avant la suite (STOCKAGE_DIR de playwright.config.ts).
// Le dossier est ignoré par Git : rien de ce qu'il contient n'est versionné.
export default async function stockageVide(): Promise<void> {
  await rm(path.resolve(".e2e-stockage"), { recursive: true, force: true })
}
