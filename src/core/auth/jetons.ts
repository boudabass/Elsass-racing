// Fonctions pures des jetons de connexion : génération, hachage, expiration,
// validation de l'adresse. Aucun accès base ici, pour pouvoir les tester seules.

import { createHash, randomBytes, randomInt } from "node:crypto"

import { z } from "zod"

export const DUREE_LIEN_MINUTES = 15
export const DUREE_CODE_MINUTES = 10

export const schemaEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse e-mail invalide.")

// Secret du lien : 32 octets aléatoires, en base64url (sans caractères spéciaux d'URL).
export function genererSecretLien(): string {
  return randomBytes(32).toString("base64url")
}

// Code à 6 chiffres, tiré avec un générateur cryptographique, zéros de tête conservés.
export function genererCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

export function estFormatCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

// Seul le hash est stocké : un accès en lecture à la base ne donne aucun jeton utilisable.
export function hacherSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

// Le code est lié à l'adresse : le même code pour deux adresses donne deux hachages distincts.
export function hacherCode(email: string, code: string): string {
  return hacherSecret(`${email}:${code}`)
}

export function calculerExpiration(maintenant: Date, minutes: number): Date {
  return new Date(maintenant.getTime() + minutes * 60_000)
}
