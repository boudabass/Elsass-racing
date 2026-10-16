// Variables CSS de la couleur de team, calculées pour les deux thèmes. Pur.
//
// Les couleurs de team ne touchent jamais aux états (vert, orange, rouge) : ceux-là ont
// leurs propres tokens dans globals.css.

import { ajusterPourFond } from "./contraste"

export const COULEUR_PRINCIPALE_DEFAUT = "#D7141A"
export const COULEUR_SECONDAIRE_DEFAUT = "#F4F3F1"

export const FOND_SOMBRE = "#0B0B0C"
export const FOND_CLAIR = "#FFFFFF"

export interface CouleursTeam {
  couleurPrincipale: string | null
  couleurSecondaire: string | null
}

export function variablesDeTeam(team: CouleursTeam): Record<string, string> {
  const principale = team.couleurPrincipale ?? COULEUR_PRINCIPALE_DEFAUT
  const secondaire = team.couleurSecondaire ?? COULEUR_SECONDAIRE_DEFAUT

  return {
    "--marque-sombre": ajusterPourFond(principale, FOND_SOMBRE),
    "--marque-clair": ajusterPourFond(principale, FOND_CLAIR),
    "--marque-2-sombre": ajusterPourFond(secondaire, FOND_SOMBRE),
    "--marque-2-clair": ajusterPourFond(secondaire, FOND_CLAIR),
  }
}
