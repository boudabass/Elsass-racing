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

// Vue dessinée par le gabarit. Une vue `miroirDe` reprend le dessin d'une autre vue, en symétrie
// horizontale à l'affichage : les formes sont les mêmes dans les coordonnées du gabarit.
export type VueDessinee = {
  vue: VueGabarit
  miroirDe?: VueGabarit
}

export type Gabarit = {
  cle: string
  nom: string
  categorie: "citadine_3p"
  version: number
  viewBox: string
  vuesDessinees: VueDessinee[]
  dessin: ElementDessin[]
  emplacementsTypes: EmplacementType[]
}
