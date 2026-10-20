import type { CoreRole } from "@/generated/prisma/client"

// Contexte d'une requête : la team courante et l'adhésion de l'utilisateur.
// Vient de la garde (exigerAcces) : jamais construit à partir d'une entrée non vérifiée.
export interface ContexteTeam {
  teamId: string
  userId: string
  membership: { id: string; role: CoreRole }
}

// Contexte d'un événement émis par le code serveur, sans utilisateur (brief 3.8, point 0.3) : la page partenaire, sans
// compte. Il ne donne aucun droit. Seul src/core/contexte-systeme-serveur.ts le fabrique, pour une origine connue.
export interface ContexteSysteme {
  teamId: string
  origine: string
  systeme: true
}

export type ContexteEvenement = ContexteTeam | ContexteSysteme

// Vrai pour un contexte d'utilisateur. Un gestionnaire qui parle au nom d'un membre (droits, adhésion) le vérifie d'abord.
export function estContexteTeam(ctx: ContexteEvenement): ctx is ContexteTeam {
  return !("systeme" in ctx)
}
