// Avertissement de sortie pendant un envoi (brief 4.7, point ouvert du 21/10). Une server action en vol est annulée par un
// rechargement ou une sortie de page : tant qu'un envoi part, le navigateur demande confirmation. Hors envoi, rien.
// Fonction pure, pour être testée sans navigateur ; FormulaireTiroir l'installe sur window.

export interface EvenementAvantSortie {
  preventDefault(): void
  returnValue: unknown
}

export function avertirAvantSortie(evenement: EvenementAvantSortie, enCours: boolean): void {
  if (!enCours) return
  evenement.preventDefault()
  // Ancienne convention, pour les navigateurs qui ne lisent que returnValue : une valeur non vide. Le texte affiché reste celui du navigateur.
  evenement.returnValue = "Un envoi est en cours."
}
