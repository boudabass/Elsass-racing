// Messages affichés quand la demande de connexion échoue. Pur : testable, et pas de
// texte technique à l'écran.

export type RaisonDemandeConnexion = "email" | "trop_de_demandes" | "envoi"

export const LIBELLES_DEMANDE_CONNEXION: Record<RaisonDemandeConnexion, string> = {
  email: "Cette adresse e-mail n'est pas valide.",
  trop_de_demandes: "Trop de demandes. Réessaie dans quelques minutes.",
  envoi: "Impossible d'envoyer le mail pour le moment. Réessaie dans quelques minutes, ou préviens le responsable de la team.",
}
