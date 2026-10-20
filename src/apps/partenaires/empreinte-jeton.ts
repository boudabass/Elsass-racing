// Empreinte du jeton de la page partenaire (brief 3.7, point 2). Fonction pure : elle ne touche ni à la base ni à
// l'environnement, pour que les tests et les scripts puissent l'importer sans DATABASE_URL.
import { createHash } from "node:crypto"

// Empreinte stockée à la place du jeton : sha256 en hexadécimal.
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex")
}
