// Registre des gestionnaires d'événements, en mémoire. Pur : aucun accès base, pour que la
// correspondance des noms et des motifs soit testable seule.

import type { ContexteTeam } from "../contexte"

export interface EvenementRecu {
  id: string
  nom: string
  version: number
  appEmettrice: string
  donnees: unknown
}

export type Gestionnaire = (ctx: ContexteTeam, evenement: EvenementRecu) => Promise<void>

interface EnregistrementGestionnaire {
  nomOuMotif: string
  fn: Gestionnaire
}

// Par app destinataire. Un gestionnaire ne doit écrire que dans ses propres tables,
// ou passer par les fonctions du socle.
const gestionnaires = new Map<string, EnregistrementGestionnaire[]>()

// nomOuMotif : un nom exact (« saison.saison_creee ») ou un motif « *.action_requise ».
export function enregistrerGestionnaire(appDestinataire: string, nomOuMotif: string, fn: Gestionnaire): void {
  const liste = gestionnaires.get(appDestinataire) ?? []
  liste.push({ nomOuMotif, fn })
  gestionnaires.set(appDestinataire, liste)
}

export function correspond(nomOuMotif: string, nom: string): boolean {
  if (nomOuMotif.startsWith("*.")) return nom.endsWith(nomOuMotif.slice(1))
  return nomOuMotif === nom
}

export function trouverGestionnaire(appDestinataire: string, nom: string): Gestionnaire | undefined {
  return gestionnaires.get(appDestinataire)?.find((e) => correspond(e.nomOuMotif, nom))?.fn
}
