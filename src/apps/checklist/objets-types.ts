// Objets liés à un point de Check-lists (tâche 5.7a, article 956 §3-§4). Types partagés : chaque app propriétaire lit son
// objet dans sa lecture partagée et le rend sous cette forme. Lecture seule : Check-lists n'écrit jamais dans ces tables.

export const TYPES_OBJET_LIE = [
  "organe_garage",
  "train_pneus",
  "papier_voiture",
  "logo_voiture",
  "licence_equipe",
  "homologation_equipe",
  "contrepartie_partenaires",
  "document_documents",
] as const
export type TypeObjetLie = (typeof TYPES_OBJET_LIE)[number]

// Types qui ne dépendent ni du véhicule ni des personnes d'un engagement : ils se proposent sur toutes les listes,
// communes comprises (décision de l'orchestrateur, 01/11).
export const PORTEE_TEAM: ReadonlySet<TypeObjetLie> = new Set<TypeObjetLie>(["contrepartie_partenaires", "document_documents"])

// Portée d'une liste : le véhicule et les personnes de son engagement. Une liste commune n'en a aucune.
export interface PorteeListe {
  vehicleId: string | null
  personIds: string[]
}

// Ce qui s'affiche d'un objet lié : son libellé, son état en texte, et s'il est à surveiller. Le texte porte l'état ;
// la couleur ne le dit jamais seule, et ne devient jamais rouge dans Check-lists.
export interface ObjetLie {
  id: string
  libelle: string
  etat: string
  alerte: boolean
}

// Ce que la lecture unitaire de l'app rend : l'objet, son type, et à quoi il se rattache (véhicule ou personne), pour
// contrôler qu'il est bien dans la portée de la liste.
export interface ObjetLieLu extends ObjetLie {
  type: TypeObjetLie
  vehicleId: string | null
  personId: string | null
}
