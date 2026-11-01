// Règle pure des objets liés à un point (tâche 5.7a, 956 §4) : un objet ne se choisit que dans la portée de sa liste.
// Sans I/O, donc testable sans base. Les lectures des apps propriétaires sont dans objets-lies-serveur.ts.
import { PORTEE_TEAM, type ObjetLieLu, type PorteeListe, type TypeObjetLie } from "./objets-types"

// Vrai si l'objet peut être lié à une liste de cette portée. Un type de portée team se propose partout ; un organe ou un
// papier se rattache à un véhicule, une licence ou une homologation à une personne de l'engagement. Une liste commune
// (sans engagement) n'a ni véhicule ni personne : elle ne reçoit donc aucun objet de véhicule ou de personne.
export function dansPortee(objet: ObjetLieLu, portee: PorteeListe): boolean {
  if (PORTEE_TEAM.has(objet.type)) return true
  if (objet.vehicleId !== null) return portee.vehicleId !== null && objet.vehicleId === portee.vehicleId
  if (objet.personId !== null) return portee.personIds.includes(objet.personId)
  return false
}

// Clé d'un objet dans une table de résolution : le type et l'identifiant, pour distinguer deux objets de même id.
export function cleLien(type: TypeObjetLie, id: string): string {
  return `${type}:${id}`
}
