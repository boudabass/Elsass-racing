// Jeton de la page partenaire (brief 3.6, point 0.1.3). Serveur seulement : les écrans importent les règles
// de Partenaires, jamais ce fichier. Le jeton en clair n'est donné qu'à la création ou au renouvellement du lien ;
// la base ne garde que son empreinte.

import "server-only"

import { randomBytes } from "node:crypto"

// Jeton de la page partenaire : 32 octets aléatoires, en base64url (43 caractères).
export function genererJeton(): string {
  return randomBytes(32).toString("base64url")
}

// L'empreinte se calcule dans empreinte-jeton.ts (fonction pure, que le middleware et les scripts importent aussi).
export { empreinteJeton } from "./empreinte-jeton"
