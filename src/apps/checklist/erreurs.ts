import { ErreurMetier } from "@/core/sdk/actions-serveur"

// Refus métier de Check-lists : le message est en français et s'affiche tel quel à l'utilisateur.
export class ErreurChecklist extends ErreurMetier {
  constructor(message: string) {
    super(message)
    this.name = "ErreurChecklist"
  }
}

export function refus(message: string): never {
  throw new ErreurChecklist(message)
}
