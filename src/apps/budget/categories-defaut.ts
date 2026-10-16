// Catégories proposées à l'activation de Budget (brief 2.5, section 2). Le nom est unique par team et par
// sens : l'initialisation ne crée jamais de doublon, elle peut donc être rejouée.

export const CATEGORIES_DEPENSE = [
  "Engagement",
  "Licence et ASA",
  "Assurance",
  "Pneus",
  "Carburant course",
  "Pièces",
  "Main-d'œuvre",
  "Équipement pilote et copilote",
  "Outillage et assistance",
  "Déplacement et carburant route",
  "Péages",
  "Hébergement",
  "Repas",
  "Communication",
  "Divers",
] as const

export const CATEGORIES_RECETTE = ["Partenaire", "Don", "Apport personnel", "Prime ou prix", "Vente", "Subvention", "Divers"] as const

export const NOM_CAISSE_TEAM = "Caisse de la team"
