// Règles pures des objets liés à un point (tâche 5.7a, article 956 §4) : un objet ne se choisit que dans la portée de sa
// liste, et son état s'écrit en texte. Sans I/O, donc testable sans base. Les lectures des apps propriétaires sont dans
// objets-lies-serveur.ts.
import { PORTEE_TEAM, type ObjetLieLu, type PorteeListe, type TypeObjetLie } from "./objets-types"

// L'app qui possède chaque type d'objet, pour la lecture de son niveau d'accès et le lien « Ouvrir dans … ».
export const APP_DU_TYPE: Record<TypeObjetLie, { cle: string; libelle: string }> = {
  organe_garage: { cle: "garage", libelle: "Garage" },
  train_pneus: { cle: "garage", libelle: "Garage" },
  papier_voiture: { cle: "voiture", libelle: "Voiture" },
  logo_voiture: { cle: "voiture", libelle: "Voiture" },
  licence_equipe: { cle: "equipe", libelle: "Équipe" },
  homologation_equipe: { cle: "equipe", libelle: "Équipe" },
  contrepartie_partenaires: { cle: "partenaires", libelle: "Partenaires" },
  document_documents: { cle: "documents", libelle: "Documents" },
}

// Vrai si l'objet peut être lié à une liste de cette portée. Un type de portée team se propose partout ; un organe ou un
// papier se rattache à un véhicule, une licence ou une homologation à une personne de l'engagement. Une liste commune
// (sans engagement) n'a ni véhicule ni personne : elle ne reçoit donc aucun objet de véhicule ou de personne.
export function dansPortee(objet: ObjetLieLu, portee: PorteeListe): boolean {
  if (PORTEE_TEAM.has(objet.type)) return true
  if (objet.vehicleId !== null) return portee.vehicleId !== null && objet.vehicleId === portee.vehicleId
  if (objet.personId !== null) return portee.personIds.includes(objet.personId)
  return false
}

// Ce qu'un point affiche de son lien. Un objet absent (supprimé, masqué, hors portée) est « introuvable » ; un type dont
// l'app n'est pas ouverte au membre est « acces_refuse », sans rien révéler de l'objet.
export type ResolutionLien =
  | { statut: "objet"; objet: ObjetLieLu }
  | { statut: "acces_refuse"; appLibelle: string }
  | { statut: "introuvable" }

// Texte d'état d'un lien : l'état de l'objet, « À surveiller » en plus quand il alerte (la couleur ne le dit jamais seule).
export function libelleEtatLien(resolution: ResolutionLien): string {
  if (resolution.statut === "acces_refuse") return `Accès réservé : tu n'as pas accès à ${resolution.appLibelle}.`
  if (resolution.statut === "introuvable") return "Objet introuvable."
  const { objet } = resolution
  return objet.alerte ? `${objet.libelle} : ${objet.etat}. À surveiller.` : `${objet.libelle} : ${objet.etat}.`
}

// Clé d'un objet dans une table de résolution : le type et l'identifiant, pour distinguer deux objets de même id.
export function cleLien(type: TypeObjetLie, id: string): string {
  return `${type}:${id}`
}
