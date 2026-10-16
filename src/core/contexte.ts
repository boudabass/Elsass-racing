import type { CoreRole } from "@/generated/prisma/client"

// Contexte d'une requête : la team courante et l'adhésion de l'utilisateur.
// Vient de la garde (exigerAcces) : jamais construit à partir d'une entrée non vérifiée.
export interface ContexteTeam {
  teamId: string
  userId: string
  membership: { id: string; role: CoreRole }
}
