// Lien de la page partenaire (brief 3.7, point 2) : retrouver un lien à partir de l'empreinte de son jeton, sans
// contexte de team. C'est le seul accès à Partenaires qui ne passe pas par une session. Le middleware s'en sert
// (il répond 404 ou 429 avant toute page), et la page aussi. Pas de « server-only » ici, pour que le middleware
// puisse l'importer ; le jeton en clair n'est jamais écrit ni renvoyé par ce module.
import { LimiteTentatives } from "@/lib/limite-tentatives-serveur"
import { prisma } from "@/lib/prisma"

import { empreinteJeton } from "./empreinte-jeton"

// Les deux messages de refus : le même 404 pour tous les cas (jeton inventé, révoqué, expiré, partenaire supprimé).
export const MESSAGE_LIEN_INVALIDE = "Ce lien n'est pas ou plus valide. Demandez un nouveau lien à la team."
export const MESSAGE_TROP_DE_TENTATIVES = "Trop de tentatives. Réessayez dans quelques minutes."

// Jeton : 32 octets en base64url, soit 43 caractères. Tout autre format est refusé sans requête.
const FORMAT_JETON = /^[A-Za-z0-9_-]{43}$/

export interface LienPublic {
  lienId: string
  teamId: string
  partnerId: string
  sections: string[]
}

// Un jeton non valide compte, par adresse ; un jeton valide ne compte pas. 30 échecs en 10 minutes, puis 429.
// En mémoire, par instance : suffisant ici, pas une garantie multi-instances (voir LimiteTentatives).
export const limiteJetonsInvalides = new LimiteTentatives(30, 10 * 60_000)

export async function trouverLienPublic(jeton: string): Promise<LienPublic | null> {
  if (!FORMAT_JETON.test(jeton)) return null
  const lignes = await prisma.$queryRaw<{ lien_id: string; team_id: string; partner_id: string; sections: string[] }[]>`
    SELECT lien_id, team_id, partner_id, sections FROM partenaires_lien_par_empreinte(${empreinteJeton(jeton)})
  `
  const ligne = lignes[0]
  if (!ligne) return null
  return { lienId: ligne.lien_id, teamId: ligne.team_id, partnerId: ligne.partner_id, sections: ligne.sections }
}
