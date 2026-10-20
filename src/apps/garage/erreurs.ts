import { ErreurMetier } from "@/core/sdk/actions-serveur"

// Refus métier du Garage : le message est en français et s'affiche tel quel à l'utilisateur.
export class ErreurGarage extends ErreurMetier {
  constructor(message: string) {
    super(message)
    this.name = "ErreurGarage"
  }
}

export function refus(message: string): never {
  throw new ErreurGarage(message)
}
