// Erreur d'accès et message affiché. Pur : importable partout, y compris côté client.

import type { Niveau } from "./niveaux"

export type RaisonAcces = "non_connecte" | "aucune_team" | "niveau_insuffisant"

export class ErreurAcces extends Error {
  constructor(
    readonly raison: RaisonAcces,
    readonly niveau: Niveau,
    readonly requis: Niveau,
    readonly appCle: string,
  ) {
    super(`Accès refusé (${raison}) à l'app ${appCle} : niveau ${niveau}, requis ${requis}.`)
    this.name = "ErreurAcces"
  }
}

// Message à l'utilisateur : dit toujours pourquoi, et ce qu'il peut faire.
export function libelleErreurAcces(erreur: ErreurAcces): string {
  switch (erreur.raison) {
    case "non_connecte":
      return "Tu n'es pas connecté. Connecte-toi pour continuer."
    case "aucune_team":
      return "Tu n'appartiens à aucune team active. Demande une invitation au responsable de ta team."
    case "niveau_insuffisant":
      return erreur.requis === "gestion"
        ? "Réservé au responsable de la team. Demande-lui l'accès."
        : `Ton accès à cette app ne suffit pas : il te faut le niveau « ${erreur.requis} ». Demande l'accès à ton responsable.`
  }
}
