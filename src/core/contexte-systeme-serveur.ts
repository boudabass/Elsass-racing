// Contexte système d'une team (brief 3.8, point 0.3) : pour un événement émis par le code serveur quand il n'y a pas
// d'utilisateur, comme la page partenaire. Seul ce module le fabrique, et seulement pour une origine connue.
//
// Choix : pas de fonction SQL dédiée. Les trois tables où le socle écrit l'événement, la livraison et l'action
// (core_domain_event, core_event_delivery, core_action) ont une politique RLS qui ne dépend que de app.team_id
// (migration 20261016144714). Le contexte système ne pose donc que app.team_id : aucun droit de membre n'est ouvert.
// Pur : pas d'accès base, pour être testé seul. Le client Prisma du contexte est dans client-contexte-serveur.ts.
import "server-only"

import type { ContexteSysteme } from "./contexte"

// Origines connues. Ajouter une origine ici est un choix de sécurité : le message ne peut venir que de là.
export const ORIGINES_SYSTEME = ["page_partenaire"] as const
export type OrigineSysteme = (typeof ORIGINES_SYSTEME)[number]

export function contexteSysteme(teamId: string, origine: OrigineSysteme): ContexteSysteme {
  if (!ORIGINES_SYSTEME.includes(origine)) throw new Error(`Origine système inconnue : « ${origine} ».`)
  return { teamId, origine, systeme: true }
}
