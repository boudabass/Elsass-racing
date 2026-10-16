import { v7 as uuidv7 } from "uuid"

// Identifiant de toute ligne en base. Généré côté client, jamais en base : le
// schéma n'a aucun `@default(uuid())`. UUID v7, donc triable par date de création.
export function newId(): string {
  return uuidv7()
}
