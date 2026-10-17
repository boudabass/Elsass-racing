// Erreur de synchro : l'appareil n'existe plus (déconnecté ou révoqué pendant une synchro). La route
// répond 401 avec un message clair ; le client doit alors aller sur /connexion.

export const MESSAGE_APPAREIL_DECONNECTE = "Cet appareil a été déconnecté."

export class ErreurAppareilRevoque extends Error {
  constructor() {
    super(MESSAGE_APPAREIL_DECONNECTE)
    this.name = "ErreurAppareilRevoque"
  }
}

// Refus métier d'une opération de synchro : le message part tel quel à l'appareil (rien n'est écrit).
export class RefusSynchro extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RefusSynchro"
  }
}
