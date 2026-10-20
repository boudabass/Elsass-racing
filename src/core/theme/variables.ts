// Variables CSS de la couleur de team, calculées pour les deux thèmes. Pur.
//
// Les couleurs de team ne touchent jamais aux états (vert, orange, rouge) : ceux-là ont
// leurs propres tokens dans globals.css.

import { ajusterPourFond } from "./contraste"

export const COULEUR_PRINCIPALE_DEFAUT = "#D7141A"
export const COULEUR_SECONDAIRE_DEFAUT = "#F4F3F1"

export const FOND_SOMBRE = "#0B0B0C"
export const FOND_CLAIR = "#FFFFFF"
// Texte posé sur la couleur de marque, dans les deux thèmes.
export const TEXTE_SUR_MARQUE = "#FFFFFF"

export interface CouleursTeam {
  couleurPrincipale: string | null
  couleurSecondaire: string | null
}

// Le texte posé sur la couleur de marque est blanc dans les deux thèmes. La marque est assombrie, si besoin, jusqu'à
// 4,5:1 avec ce blanc : on ajuste la couleur, on n'inverse pas le texte (brief 3.11, §10).
export function variablesDeTeam(team: CouleursTeam): Record<string, string> {
  const principale = team.couleurPrincipale ?? COULEUR_PRINCIPALE_DEFAUT
  const secondaire = team.couleurSecondaire ?? COULEUR_SECONDAIRE_DEFAUT
  const marqueSombre = ajusterPourFond(principale, TEXTE_SUR_MARQUE)
  const marqueClaire = ajusterPourFond(principale, TEXTE_SUR_MARQUE)

  return {
    "--marque-sombre": marqueSombre,
    "--marque-clair": marqueClaire,
    "--marque-texte-sombre": TEXTE_SUR_MARQUE,
    "--marque-texte-clair": TEXTE_SUR_MARQUE,
    "--marque-2-sombre": ajusterPourFond(secondaire, FOND_SOMBRE),
    "--marque-2-clair": ajusterPourFond(secondaire, FOND_CLAIR),
  }
}
