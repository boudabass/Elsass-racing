import { ErreurMetier } from "@/core/sdk/actions-serveur"

// Refus métier de Partenaires : le message est en français et s'affiche tel quel à l'utilisateur.
export class ErreurPartenaires extends ErreurMetier {
  constructor(message: string) {
    super(message)
    this.name = "ErreurPartenaires"
  }
}

export function refus(message: string): never {
  throw new ErreurPartenaires(message)
}
