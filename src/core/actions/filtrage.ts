// Boîte d'actions : modèle d'une action et filtrage par destinataire. Pur.

import { aAuMoins, type Niveau } from "../droits/niveaux"

export interface Bouton {
  cle: string
  libelle: string
}

// Forme de destinataires stockée dans core_action.destinataires (Json).
export interface DestinatairesAction {
  roles: string[]
  memberships: string[]
  niveauRequis: Niveau
  terrain: boolean
}

export interface ActionBoite {
  id: string
  appOrigine: string
  type: string
  cleUnicite: string
  titre: string
  contexte: string | null
  ficheType: string | null
  ficheId: string | null
  eventId: string | null
  priorite: number
  bloquant: boolean
  echeance: Date | null
  cleRegroupement: string | null
  destinataires: DestinatairesAction
  boutons: Bouton[]
  createdAt: Date
  reporteeJusquAu: Date | null
  statut: string
}

// Lit le Json stocké, avec les valeurs par défaut : niveau ecriture, pas terrain.
// Un Json inattendu donne un destinataire vide, donc une action invisible.
export function lireDestinataires(json: unknown): DestinatairesAction {
  const brut = (typeof json === "object" && json !== null ? json : {}) as Partial<DestinatairesAction>
  return {
    roles: Array.isArray(brut.roles) ? brut.roles : [],
    memberships: Array.isArray(brut.memberships) ? brut.memberships : [],
    niveauRequis: (brut.niveauRequis as Niveau) ?? "ecriture",
    terrain: brut.terrain === true,
  }
}

export interface PourMembre {
  membershipId: string
  role: string
  niveauParApp: Record<string, Niveau>
}

// Garde une action si le membre est destinataire (par rôle ou par membership) et si son
// niveau sur l'app d'origine couvre le niveau requis.
export function actionsPourMembre(actions: readonly ActionBoite[], pour: PourMembre): ActionBoite[] {
  return actions.filter((action) => {
    const destinataires = action.destinataires
    const destinataire =
      destinataires.roles.includes(pour.role) || destinataires.memberships.includes(pour.membershipId)
    if (!destinataire) return false
    const niveau = pour.niveauParApp[action.appOrigine] ?? "aucun"
    return aAuMoins(niveau, destinataires.niveauRequis)
  })
}
