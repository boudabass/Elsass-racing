// Erreur de synchro : l'appareil n'existe plus (déconnecté ou révoqué pendant une synchro). La route
// répond 401 avec un message clair ; le client doit alors aller sur /connexion.

export const MESSAGE_APPAREIL_DECONNECTE = "Cet appareil a été déconnecté."

export class ErreurAppareilRevoque extends Error {
  constructor() {
    super(MESSAGE_APPAREIL_DECONNECTE)
    this.name = "ErreurAppareilRevoque"
  }
}
