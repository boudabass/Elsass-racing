// Registre des gestionnaires d'événements, en mémoire. Pur : aucun accès base, pour que la
// correspondance des noms et des motifs soit testable seule.

import type { ContexteEvenement, ContexteTeam } from "../contexte"

export interface EvenementRecu {
  id: string
  nom: string
  version: number
  appEmettrice: string
  donnees: unknown
}

// Gestionnaire d'une app : il parle au nom d'un membre. Un événement émis par un contexte système ne lui est pas livré.
export type Gestionnaire = (ctx: ContexteTeam, evenement: EvenementRecu) => Promise<void>

// Gestionnaire qui accepte aussi un contexte système (seul le socle en a besoin : action_requise émise par la page partenaire).
export type GestionnaireTousContextes = (ctx: ContexteEvenement, evenement: EvenementRecu) => Promise<void>

export type EnregistrementGestionnaire =
  | { nomOuMotif: string; tousContextes: false; fn: Gestionnaire }
  | { nomOuMotif: string; tousContextes: true; fn: GestionnaireTousContextes }

// Par app destinataire. Un gestionnaire ne doit écrire que dans ses propres tables,
// ou passer par les fonctions du socle.
const gestionnaires = new Map<string, EnregistrementGestionnaire[]>()

function ajouter(appDestinataire: string, enregistrement: EnregistrementGestionnaire): void {
  const liste = gestionnaires.get(appDestinataire) ?? []
  liste.push(enregistrement)
  gestionnaires.set(appDestinataire, liste)
}

// nomOuMotif : un nom exact (« saison.saison_creee ») ou un motif « *.action_requise ».
export function enregistrerGestionnaire(appDestinataire: string, nomOuMotif: string, fn: Gestionnaire): void {
  ajouter(appDestinataire, { nomOuMotif, tousContextes: false, fn })
}

// Même registre, pour un gestionnaire qui sait traiter un événement émis sans utilisateur.
export function enregistrerGestionnaireTousContextes(appDestinataire: string, nomOuMotif: string, fn: GestionnaireTousContextes): void {
  ajouter(appDestinataire, { nomOuMotif, tousContextes: true, fn })
}

export function correspond(nomOuMotif: string, nom: string): boolean {
  if (nomOuMotif.startsWith("*.")) return nom.endsWith(nomOuMotif.slice(1))
  return nomOuMotif === nom
}

export function trouverEnregistrement(appDestinataire: string, nom: string): EnregistrementGestionnaire | undefined {
  return gestionnaires.get(appDestinataire)?.find((e) => correspond(e.nomOuMotif, nom))
}

export function trouverGestionnaire(appDestinataire: string, nom: string): Gestionnaire | GestionnaireTousContextes | undefined {
  return trouverEnregistrement(appDestinataire, nom)?.fn
}
