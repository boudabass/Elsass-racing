// État du formulaire de connexion, partagé entre l'action serveur et le composant.
// Fichier à part : un module « use server » n'exporte que des actions.

export interface EtatConnexion {
  etape: "email" | "code"
  email?: string
  erreur?: string
}
