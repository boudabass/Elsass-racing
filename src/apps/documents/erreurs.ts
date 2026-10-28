import { ErreurMetier } from "@/core/sdk/actions-serveur"

// Refus métier de Documents : le message est en français, tutoiement, et s'affiche tel quel à l'utilisateur.
export class ErreurDocuments extends ErreurMetier {
  constructor(message: string) {
    super(message)
    this.name = "ErreurDocuments"
  }
}

export function refus(message: string): never {
  throw new ErreurDocuments(message)
}
