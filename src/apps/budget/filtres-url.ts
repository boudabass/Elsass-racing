// Filtres des listes de Budget (mouvements et recettes), dans l'URL. Les deux listes partagent les mêmes filtres,
// les mêmes pastilles et le même retrait : retirer une pastille ne touche pas aux autres (brief 3.14, point 3).

export interface ParametresFiltres {
  saison?: string
  epreuve?: string
  categorie?: string
  membre?: string
  m?: string
}

export interface ChoixFiltres {
  epreuves: Array<{ id: string; nom: string }>
  categoriesDepense: Array<{ id: string; nom: string }>
  categoriesRecette: Array<{ id: string; nom: string }>
  payeurs: Array<{ id: string; nom: string }>
}

// Paramètres à reporter dans l'URL : les valeurs non vides, sauf celles de la liste donnée (la fiche ouverte, un filtre retiré).
export function parametresSauf(parametres: ParametresFiltres, sauf: string[]): string {
  const entrees = Object.entries(parametres).filter(([cle, valeur]) => valeur && !sauf.includes(cle)) as [string, string][]
  return new URLSearchParams(entrees).toString()
}

// Pastilles des filtres actifs, chacune avec l'adresse qui retire ce seul filtre. La saison n'a pas de pastille :
// c'est le choix de période.
export function pastillesFiltres(parametres: ParametresFiltres, choix: ChoixFiltres, base: string) {
  const pastilles = [
    ...(parametres.epreuve ? [{ cle: "epreuve", libelle: choix.epreuves.find((epreuve) => epreuve.id === parametres.epreuve)?.nom ?? "Épreuve" }] : []),
    ...(parametres.categorie
      ? [{ cle: "categorie", libelle: [...choix.categoriesDepense, ...choix.categoriesRecette].find((categorie) => categorie.id === parametres.categorie)?.nom ?? "Catégorie" }]
      : []),
    ...(parametres.membre ? [{ cle: "membre", libelle: choix.payeurs.find((payeur) => payeur.id === parametres.membre)?.nom ?? "Membre" }] : []),
  ]
  return pastilles.map((pastille) => {
    const suite = parametresSauf(parametres, ["m", pastille.cle])
    return { ...pastille, retirer: `${base}${suite ? `?${suite}` : ""}` }
  })
}
