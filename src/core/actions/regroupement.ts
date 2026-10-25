// Regroupement des actions de même nature (cleRegroupement). Pur.

import type { ActionBoite } from "./filtrage"

// Libellés par type d'action levé par une app (brief 3.9, §2). Un type absent de cette table garde un titre
// générique « n actions », jamais le type interne. Le test libelles-regroupement.test.ts vérifie que chaque type
// passé à un « *.action_requise » dans src/ figure ici.
export const LIBELLES_TYPES: Record<string, { singulier: string; pluriel: string }> = {
  depense_a_confirmer: { singulier: "dépense à confirmer", pluriel: "dépenses à confirmer" },
  mouvement_a_confirmer: { singulier: "mouvement à confirmer", pluriel: "mouvements à confirmer" },
  papier_a_renouveler: { singulier: "papier à renouveler", pluriel: "papiers à renouveler" },
  disponibilite_a_repondre: { singulier: "disponibilité à donner", pluriel: "disponibilités à donner" },
  licence_a_renouveler: { singulier: "licence à renouveler", pluriel: "licences à renouveler" },
  homologation_a_renouveler: { singulier: "homologation à renouveler", pluriel: "homologations à renouveler" },
  emplacement_pris: { singulier: "emplacement déjà pris", pluriel: "emplacements déjà pris" },
  reserver_emplacement: { singulier: "emplacement à réserver", pluriel: "emplacements à réserver" },
  liberer_emplacement: { singulier: "emplacement à libérer", pluriel: "emplacements à libérer" },
  emplacement_supprime: { singulier: "emplacement supprimé", pluriel: "emplacements supprimés" },
  preuve_pose: { singulier: "preuve de pose à ajouter", pluriel: "preuves de pose à ajouter" },
  publications_promises: { singulier: "publication promise à suivre", pluriel: "publications promises à suivre" },
  contrepartie_en_retard: { singulier: "contrepartie en retard", pluriel: "contreparties en retard" },
  message_partenaire: { singulier: "message de partenaire", pluriel: "messages de partenaires" },
  resultat_a_valider: { singulier: "résultat à valider", pluriel: "résultats à valider" },
  resultat_a_saisir: { singulier: "résultat à saisir", pluriel: "résultats à saisir" },
  cloture_saison_proposee: { singulier: "clôture de saison proposée", pluriel: "clôtures de saison proposées" },
  cloture_engagements: { singulier: "rappel de clôture des engagements", pluriel: "rappels de clôture des engagements" },
  reconnaissance: { singulier: "reconnaissance à faire", pluriel: "reconnaissances à faire" },
  programme_du_jour: { singulier: "programme du jour à préparer", pluriel: "programmes du jour à préparer" },
  marquer_engagement_paye: { singulier: "engagement à marquer payé", pluriel: "engagements à marquer payés" },
}

export interface GroupeAction {
  cleRegroupement: string | null
  appOrigine: string
  type: string
  actions: ActionBoite[]
  nombre: number
  titreGroupe: string
}

function titreDeGroupe(actions: ActionBoite[]): string {
  const premiere = actions[0]
  const n = actions.length
  if (n === 1) return premiere.titre
  const libelle = LIBELLES_TYPES[premiere.type]
  return libelle ? `${n} ${libelle.pluriel}` : `${n} actions`
}

// Une action sans cleRegroupement forme son propre groupe. Les groupes gardent l'ordre
// de première apparition dans la liste.
export function grouperActions(actions: readonly ActionBoite[]): GroupeAction[] {
  const parCle = new Map<string, ActionBoite[]>()
  const groupes: Array<{ cle: string | null; actions: ActionBoite[] }> = []

  for (const action of actions) {
    if (action.cleRegroupement === null) {
      groupes.push({ cle: null, actions: [action] })
      continue
    }
    const existant = parCle.get(action.cleRegroupement)
    if (existant) {
      existant.push(action)
    } else {
      const nouveau = [action]
      parCle.set(action.cleRegroupement, nouveau)
      groupes.push({ cle: action.cleRegroupement, actions: nouveau })
    }
  }

  return groupes.map(({ cle, actions: membres }) => ({
    cleRegroupement: cle,
    appOrigine: membres[0].appOrigine,
    type: membres[0].type,
    actions: membres,
    nombre: membres.length,
    titreGroupe: titreDeGroupe(membres),
  }))
}
