// Types d'organes suivis par défaut (article 954, « Organes suivis par défaut »). Copiés dans la team au premier
// besoin, comme le modèle de convention de Partenaires : une lecture n'écrit jamais. La team peut en ajouter, en
// modifier, en retirer. `cle` relie la copie à sa position dans src/apps/garage/positions.ts.
export const TYPES_DEFAUT = [
  { cle: "moteur", nom: "Moteur", icone: "moteur", critique: true, ordre: 1 },
  { cle: "boite", nom: "Boîte de vitesses", icone: "boite", critique: true, ordre: 2 },
  { cle: "embrayage", nom: "Embrayage", icone: "embrayage", critique: true, ordre: 3 },
  { cle: "transmissions", nom: "Transmissions", icone: "transmissions", critique: true, ordre: 4 },
  { cle: "freins", nom: "Freins", icone: "freins", critique: true, ordre: 5 },
  { cle: "amortisseurs", nom: "Amortisseurs", icone: "amortisseurs", critique: false, ordre: 6 },
  { cle: "pneus", nom: "Pneus", icone: "pneus", critique: false, ordre: 7 },
] as const

// Mode d'usure d'un organe créé par défaut : « les deux ». Sans durée saisie, l'organe reste « À renseigner » et
// n'entre pas dans l'indice : aucune valeur n'est inventée (décision de John du 20/10).
export const MODE_USURE_DEFAUT = "les_deux" as const
