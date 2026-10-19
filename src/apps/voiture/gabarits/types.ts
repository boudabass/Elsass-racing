// Types des gabarits de véhicule (tâche 3.2). Un gabarit est un catalogue de la plateforme :
// il vit dans le code, pas en base. Les coordonnées sont celles du viewBox du gabarit.

// Rôles de couleur du dessin. Le thème les associe aux couleurs à l'affichage (tâche 3.4).
export type RoleDessin = "caisse" | "vitre" | "roue" | "jante" | "detail" | "sol"

export type ElementDessin = {
  type: "path" | "circle" | "line"
  role: RoleDessin
  attributs: Record<string, string | number>
}

// Vue d'un emplacement. `hors_plan` : l'emplacement existe, mais le plan ne le dessine pas.
export type VueGabarit = "droite" | "gauche" | "avant" | "arriere" | "dessus" | "hors_plan"

export type FormeEmplacement =
  | { type: "rect"; x: number; y: number; l: number; h: number }
  | { type: "polygone"; points: Array<[number, number]> }

export type EmplacementType = {
  ordre: number
  nom: string
  vue: VueGabarit
  forme: FormeEmplacement | null
  symetrique: boolean
}

// Vue dessinée par le gabarit, avec son propre dessin. Une vue `miroirDe` n'a pas de dessin : elle reprend celui
// d'une autre vue, retourné autour de l'axe vertical du viewBox. Les emplacements, eux, ont toujours leur forme
// stockée dans leur vue : la vue gauche n'est pas un miroir à l'affichage pour les emplacements.
export type VueDessinee = {
  vue: VueGabarit
  miroirDe?: VueGabarit
  dessin?: ElementDessin[]
}

export type Gabarit = {
  cle: string
  nom: string
  categorie: "citadine_3p" | "generique"
  version: number
  viewBox: string
  vuesDessinees: VueDessinee[]
  emplacementsTypes: EmplacementType[]
  // Noms d'emplacements que des versions précédentes du gabarit portaient, et qu'il ne porte plus. Le complément
  // retire les lignes libres de ces noms ; une ligne occupée ou liée à une contrepartie reste, et il le signale.
  nomsRetires?: string[]
}
