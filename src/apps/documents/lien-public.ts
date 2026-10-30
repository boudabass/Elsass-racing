// Lien de partage d'un document (tâche 5.4, brief §1 « Page publique »). Retrouver un lien à partir de l'empreinte de son
// jeton, sans contexte de team : c'est le seul accès à Documents qui ne passe pas par une session. Le middleware s'en sert
// (il répond « Ce lien n'est plus valable » avant toute page), et la page le refait pour lire les données.
// Le jeton en clair n'est jamais écrit ni renvoyé par ce module.
import { createHash } from "node:crypto"

import { LimiteTentatives } from "@/lib/limite-tentatives-serveur"
import { prisma } from "@/lib/prisma"

// Même message pour tous les cas : jeton inventé, révoqué, expiré, document archivé ou supprimé. Rien n'indique lequel.
export const MESSAGE_LIEN_DOCUMENT_INVALIDE = "Ce lien n'est plus valable."
export const MESSAGE_TROP_DE_TENTATIVES = "Trop de tentatives. Réessayez dans quelques minutes."

// Jeton : 32 octets en base64url, soit 43 caractères. Tout autre format est refusé sans requête.
const FORMAT_JETON = /^[A-Za-z0-9_-]{43}$/

// Empreinte stockée à la place du jeton : sha256 en hexadécimal (même règle que les liens de Partenaires).
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex")
}

export interface LienDocument {
  shareId: string
  teamId: string
  docId: string
}

// Un jeton invalide compte, par adresse ; un jeton valide ne compte pas. 30 échecs en 10 minutes, puis 429. Même politique
// que la page partenaire (en mémoire, par instance).
export const limiteLiensInvalides = new LimiteTentatives(30, 10 * 60_000)

export async function trouverLienDocument(jeton: string): Promise<LienDocument | null> {
  if (!FORMAT_JETON.test(jeton)) return null
  const lignes = await prisma.$queryRaw<{ share_id: string; team_id: string; doc_id: string }[]>`
    SELECT share_id, team_id, doc_id FROM documents_lien_par_empreinte(${empreinteJeton(jeton)})
  `
  const ligne = lignes[0]
  if (!ligne) return null
  return { shareId: ligne.share_id, teamId: ligne.team_id, docId: ligne.doc_id }
}
