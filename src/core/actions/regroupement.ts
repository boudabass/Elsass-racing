// Regroupement des actions de même nature (cleRegroupement). Pur.

import type { ActionBoite } from "./filtrage"

// Libellés pluriels par type d'action. Un type absent de cette table garde un titre
// générique : « n actions : <type> ». Table à compléter avec les apps qui émettent.
export const LIBELLES_TYPES: Record<string, { singulier: string; pluriel: string }> = {
  depense_a_confirmer: { singulier: "dépense à confirmer", pluriel: "dépenses à confirmer" },
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
  return libelle ? `${n} ${libelle.pluriel}` : `${n} actions : ${premiere.type}`
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
