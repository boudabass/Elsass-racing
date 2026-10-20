// Catalogue des apps et des droits par défaut. Source unique : prisma/seed.ts
// écrit ces valeurs en base, et les tests les vérifient.
//
// Les types sont écrits à la main, sans dépendre du client Prisma généré : ce
// module reste utilisable sans `prisma generate`. Les valeurs sont celles des
// enums CoreRole et CoreAccessLevel du schéma.

export type RoleCore = "responsable" | "equipage" | "assistance" | "invite"

export type NiveauAcces = "aucun" | "lecture" | "contribution" | "ecriture" | "gestion"

export type AppCle =
  | "saison"
  | "budget"
  | "partenaires"
  | "voiture"
  | "garage"
  | "equipe"
  | "checklist"
  | "documents"
  | "medias"
  | "dashboard"
  | "settings"

export interface AppCatalogue {
  cle: AppCle
  nom: string
  icone: string
  version: string
  requiert: AppCle[]
}

export interface DroitParDefaut {
  role: RoleCore
  appCle: AppCle
  niveau: NiveauAcces
}

export const APPS: readonly AppCatalogue[] = [
  { cle: "saison", nom: "Saison", icone: "calendar-days", version: "0.1.0", requiert: [] },
  { cle: "budget", nom: "Budget", icone: "euro", version: "0.1.0", requiert: [] },
  { cle: "partenaires", nom: "Partenaires", icone: "handshake", version: "0.1.0", requiert: ["budget"] },
  { cle: "voiture", nom: "Voiture", icone: "car", version: "0.1.0", requiert: [] },
  { cle: "garage", nom: "Garage", icone: "wrench", version: "0.2.0", requiert: ["voiture"] },
  { cle: "equipe", nom: "Équipe", icone: "users", version: "0.1.0", requiert: [] },
  { cle: "checklist", nom: "Check-lists", icone: "list-checks", version: "0.1.0", requiert: ["saison"] },
  { cle: "documents", nom: "Documents", icone: "folder", version: "0.1.0", requiert: [] },
  { cle: "medias", nom: "Médias", icone: "camera", version: "0.1.0", requiert: ["saison"] },
  { cle: "dashboard", nom: "Tableau de bord", icone: "layout-dashboard", version: "0.1.0", requiert: [] },
  { cle: "settings", nom: "Réglages", icone: "settings", version: "0.1.0", requiert: [] },
]

// Article 962, section 4 : 4 rôles × 11 apps.
export const DROITS_PAR_DEFAUT: readonly DroitParDefaut[] = [
  // saison
  { role: "responsable", appCle: "saison", niveau: "gestion" },
  { role: "equipage", appCle: "saison", niveau: "ecriture" },
  { role: "assistance", appCle: "saison", niveau: "lecture" },
  { role: "invite", appCle: "saison", niveau: "aucun" },
  // budget
  { role: "responsable", appCle: "budget", niveau: "gestion" },
  { role: "equipage", appCle: "budget", niveau: "ecriture" },
  { role: "assistance", appCle: "budget", niveau: "contribution" },
  { role: "invite", appCle: "budget", niveau: "aucun" },
  // partenaires
  { role: "responsable", appCle: "partenaires", niveau: "gestion" },
  { role: "equipage", appCle: "partenaires", niveau: "ecriture" },
  { role: "assistance", appCle: "partenaires", niveau: "aucun" },
  { role: "invite", appCle: "partenaires", niveau: "aucun" },
  // voiture
  { role: "responsable", appCle: "voiture", niveau: "gestion" },
  { role: "equipage", appCle: "voiture", niveau: "ecriture" },
  { role: "assistance", appCle: "voiture", niveau: "contribution" },
  { role: "invite", appCle: "voiture", niveau: "aucun" },
  // garage
  { role: "responsable", appCle: "garage", niveau: "gestion" },
  { role: "equipage", appCle: "garage", niveau: "ecriture" },
  { role: "assistance", appCle: "garage", niveau: "contribution" },
  { role: "invite", appCle: "garage", niveau: "aucun" },
  // equipe
  { role: "responsable", appCle: "equipe", niveau: "gestion" },
  { role: "equipage", appCle: "equipe", niveau: "ecriture" },
  { role: "assistance", appCle: "equipe", niveau: "contribution" },
  { role: "invite", appCle: "equipe", niveau: "aucun" },
  // checklist
  { role: "responsable", appCle: "checklist", niveau: "gestion" },
  { role: "equipage", appCle: "checklist", niveau: "ecriture" },
  { role: "assistance", appCle: "checklist", niveau: "contribution" },
  { role: "invite", appCle: "checklist", niveau: "aucun" },
  // documents
  { role: "responsable", appCle: "documents", niveau: "gestion" },
  { role: "equipage", appCle: "documents", niveau: "ecriture" },
  { role: "assistance", appCle: "documents", niveau: "contribution" },
  { role: "invite", appCle: "documents", niveau: "aucun" },
  // medias
  { role: "responsable", appCle: "medias", niveau: "gestion" },
  { role: "equipage", appCle: "medias", niveau: "ecriture" },
  { role: "assistance", appCle: "medias", niveau: "contribution" },
  { role: "invite", appCle: "medias", niveau: "aucun" },
  // dashboard
  { role: "responsable", appCle: "dashboard", niveau: "gestion" },
  { role: "equipage", appCle: "dashboard", niveau: "contribution" },
  { role: "assistance", appCle: "dashboard", niveau: "lecture" },
  { role: "invite", appCle: "dashboard", niveau: "aucun" },
  // settings
  { role: "responsable", appCle: "settings", niveau: "gestion" },
  { role: "equipage", appCle: "settings", niveau: "lecture" },
  { role: "assistance", appCle: "settings", niveau: "aucun" },
  { role: "invite", appCle: "settings", niveau: "aucun" },
]
