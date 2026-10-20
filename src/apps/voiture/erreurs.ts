import { ErreurMetier } from "@/core/sdk/actions-serveur"

// Refus métier de Voiture : le message est en français et s'affiche tel quel à l'utilisateur.
export class ErreurVoiture extends ErreurMetier {
  constructor(message: string) {
    super(message)
    this.name = "ErreurVoiture"
  }
}

export function refus(message: string): never {
  throw new ErreurVoiture(message)
}
