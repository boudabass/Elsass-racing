import { ErreurMetier } from "@/core/sdk/actions-serveur"

// Refus métier d'Équipe : le message est en français et s'affiche tel quel à l'utilisateur.
export class ErreurEquipe extends ErreurMetier {
  constructor(message: string) {
    super(message)
    this.name = "ErreurEquipe"
  }
}

export function refus(message: string): never {
  throw new ErreurEquipe(message)
}
