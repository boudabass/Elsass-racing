// Variables CSS de la couleur de team, calculées pour les deux thèmes. Pur.
//
// Les couleurs de team ne touchent jamais aux états (vert, orange, rouge) : ceux-là ont
// leurs propres tokens dans globals.css.

import { ajusterPourFond, texteSur } from "./contraste"

export const COULEUR_PRINCIPALE_DEFAUT = "#D7141A"
export const COULEUR_SECONDAIRE_DEFAUT = "#F4F3F1"

export const FOND_SOMBRE = "#0B0B0C"
export const FOND_CLAIR = "#FFFFFF"

export interface CouleursTeam {
  couleurPrincipale: string | null
  couleurSecondaire: string | null
}

// Le texte posé sur la couleur de marque se choisit par thème : la marque y est déjà ajustée
// pour le fond, donc c'est le blanc ou le quasi-noir qui la lit le mieux.
export function variablesDeTeam(team: CouleursTeam): Record<string, string> {
  const principale = team.couleurPrincipale ?? COULEUR_PRINCIPALE_DEFAUT
  const secondaire = team.couleurSecondaire ?? COULEUR_SECONDAIRE_DEFAUT
  const marqueSombre = ajusterPourFond(principale, FOND_SOMBRE)
  const marqueClaire = ajusterPourFond(principale, FOND_CLAIR)

  return {
    "--marque-sombre": marqueSombre,
    "--marque-clair": marqueClaire,
    "--marque-texte-sombre": texteSur(marqueSombre),
    "--marque-texte-clair": texteSur(marqueClaire),
    "--marque-2-sombre": ajusterPourFond(secondaire, FOND_SOMBRE),
    "--marque-2-clair": ajusterPourFond(secondaire, FOND_CLAIR),
  }
}
