// Règles pures des propositions de Check-lists issues des écoutes (tâche 5.7b, article 956 §3 et §5). Aucune lecture
// ni écriture ici : les écoutes (ecoutes-serveur.ts) rassemblent les faits, ces fonctions décident.
import type { StatutPoint } from "./regles"
import type { TypeObjetLie } from "./objets-types"

export type TypeProposition = "ajouter_point" | "cocher_point" | "creer_liste_retour" | "relire_liste"

// Un point se coche tant qu'il n'est ni fait ni sans objet (décision de l'orchestrateur, 01/11) : un problème se coche.
export function pointCochable(statut: StatutPoint): boolean {
  return statut === "a_faire" || statut === "probleme"
}

// Une proposition est un doublon si une autre, quel que soit son statut (proposée, acceptée ou ignorée), vise le même
// type, le même objet et la même liste (décision de l'orchestrateur, 02/11). Une team qui a dit non n'est pas relancée.
export interface Visee {
  type: TypeProposition
  cle: string
  listeId: string | null
}

export function estDoublon(existantes: readonly Visee[], nouvelle: Visee): boolean {
  return existantes.some((existante) => existante.type === nouvelle.type && existante.cle === nouvelle.cle && existante.listeId === nouvelle.listeId)
}

// Les engagements d'une épreuve qui n'ont pas encore de liste de phase retour : seuls ceux-là reçoivent une proposition.
export function engagementsSansListeRetour(engagementIds: readonly string[], engagementsAvecRetour: ReadonlySet<string>): string[] {
  return engagementIds.filter((id) => !engagementsAvecRetour.has(id))
}

// Un point est déjà lié à cet objet dans la liste : la proposition d'ajout n'a plus lieu d'être.
export function pointDejaLie(points: readonly { lienType: string; lienId: string | null }[], lienType: TypeObjetLie, lienId: string): boolean {
  return points.some((point) => point.lienType === lienType && point.lienId === lienId)
}

// Libellé d'un point proposé, construit depuis l'objet de l'autre app (décision de l'orchestrateur, 01/11) : jamais inventé.
// Seuls les types que les écoutes de 5.7b proposent ont une forme ; « Remplacer la pièce » vient de 956.
export type TypeObjetPropose = Extract<TypeObjetLie, "organe_garage" | "papier_voiture" | "licence_equipe" | "homologation_equipe" | "contrepartie_partenaires" | "document_documents">

const FORME_POINT: Record<TypeObjetPropose, (libelle: string) => string> = {
  organe_garage: (libelle) => `Remplacer la pièce : ${libelle}`,
  papier_voiture: (libelle) => `Papier à renouveler : ${libelle}`,
  licence_equipe: (libelle) => `Licence à renouveler : ${libelle}`,
  homologation_equipe: (libelle) => `Homologation à renouveler : ${libelle}`,
  contrepartie_partenaires: (libelle) => `Contrepartie en retard : ${libelle}`,
  document_documents: (libelle) => `Document à renouveler : ${libelle}`,
}

export function titrePointPropose(lienType: TypeObjetPropose, libelle: string): string {
  return FORME_POINT[lienType](libelle)
}

// Le point ajouté par « relire un règlement » (relire_liste) : même principe, le titre du document.
export function titreRelireReglement(titre: string): string {
  return `Relire le règlement : ${titre}`
}
