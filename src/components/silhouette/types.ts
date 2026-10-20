// Types du dessin d'une silhouette (brief 4.2, point 0) : un gabarit de véhicule est un dessin en traits SVG, partagé
// par Voiture (plan de déco, plan des emplacements) et Garage (atelier). Voiture les réexporte depuis ses gabarits.

// Rôles de couleur du dessin. Le thème les associe aux couleurs à l'affichage (tâche 3.4).
export type RoleDessin = "caisse" | "vitre" | "roue" | "jante" | "detail" | "sol"

export type ElementDessin = {
  type: "path" | "circle" | "line"
  role: RoleDessin
  attributs: Record<string, string | number>
}
