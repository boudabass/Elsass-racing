// Écran d'accueil de chaque app, à la première ouverture par un membre : trois lignes au plus.
// Les apps sans écran propre ici (Réglages) n'en ont pas.

export interface EcranDecouverte {
  lignes: string[]
}

export const ECRANS_DECOUVERTE: Record<string, EcranDecouverte> = {
  saison: {
    lignes: [
      "Le calendrier de la saison et ses épreuves.",
      "Chaque épreuve a ses dates, son lieu et ses engagements.",
      "Les résultats à valider remontent dans la boîte d'actions.",
    ],
  },
  budget: {
    lignes: [
      "Les recettes et les dépenses de la saison.",
      "Une dépense saisie avec le bouton + attend ta confirmation.",
      "Le solde s'affiche en haut de l'écran.",
    ],
  },
  partenaires: {
    lignes: [
      "Les partenaires de la team et leurs contreparties.",
      "Les relances à faire apparaissent dans la boîte d'actions.",
      "Les contrats se suivent ici, du premier contact à la signature.",
    ],
  },
  voiture: {
    lignes: [
      "La fiche technique de la voiture.",
      "Les pièces, les pneus et les documents du véhicule.",
      "Les contrôles à venir apparaissent dans la boîte d'actions.",
    ],
  },
  garage: {
    lignes: [
      "Les interventions et les pièces du garage.",
      "Les alertes de maintenance remontent sur le QG.",
      "Les dépenses du garage attendent ta confirmation dans Budget.",
    ],
  },
  equipe: {
    lignes: [
      "Les membres de l'équipage et leurs disponibilités.",
      "Les invitations en attente et les rôles.",
      "Les affectations aux épreuves se font ici.",
    ],
  },
  checklist: {
    lignes: [
      "Les listes de contrôle avant chaque épreuve.",
      "Les éléments à terminer remontent comme suggestions.",
      "Une check-list peut être partagée avec l'équipage.",
    ],
  },
  documents: {
    lignes: [
      "Les pièces administratives de la team.",
      "Les licences, les assurances et les engagements.",
      "Les échéances proches remontent dans la boîte d'actions.",
    ],
  },
  medias: {
    lignes: [
      "Les photos et les vidéos de la team.",
      "Chaque photo peut être rattachée à une épreuve.",
      "Les contreparties pour les partenaires se préparent ici.",
    ],
  },
  dashboard: {
    lignes: [
      "Le tableau de bord de la saison, en un coup d'œil.",
      "Les chiffres clés viennent des autres apps.",
      "Le journal de la team y est aussi tenu.",
    ],
  },
}
