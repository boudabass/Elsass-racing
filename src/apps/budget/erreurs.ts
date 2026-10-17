// Refus métier de Budget : le message est en français et s'affiche tel quel à l'utilisateur.
export class ErreurBudget extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErreurBudget"
  }
}

export function refus(message: string): never {
  throw new ErreurBudget(message)
}

// Montant en euros pour un message : 1234 -> « 12,34 € ».
export function eurosPourMessage(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`
}
