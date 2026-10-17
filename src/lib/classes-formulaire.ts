// Classes partagées des formulaires de toutes les apps : un seul endroit à changer.
export const CHAMP =
  "min-h-11 w-full rounded-md border border-bordure-champ bg-surface px-3 py-2 text-texte focus:outline-none focus:ring-2 focus:ring-marque"

export const BOUTON =
  "cible-tactile rounded-md bg-marque px-5 py-3 font-medium text-marque-texte hover:opacity-90 disabled:opacity-50"

// Bouton secondaire : même hauteur et même retrait que BOUTON, sans fond de couleur.
export const BOUTON_SECONDAIRE =
  "cible-tactile rounded-md border border-bordure px-5 py-3 text-sm hover:bg-surface-2 disabled:opacity-50"

// Lien d'action dans le texte : souligné en permanence (le soulignement dit que c'est un lien), cible de 44 px.
export const LIEN = "cible-tactile inline-flex items-center underline underline-offset-4 decoration-marque decoration-2 hover:text-marque"
