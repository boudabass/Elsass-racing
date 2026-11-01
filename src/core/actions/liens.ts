// Boutons-liens d'une action de la boîte (5.6, §0). Un bouton-lien ouvre une fiche : il ne décide pas l'action, qui
// reste en attente jusqu'à la levée par son app (<app>.action_levee). Règle dans docs/evenements.md. Pur.

export interface BoutonAction {
  cle: string
  libelle: string
  // Chemin relatif sous l'app d'origine (/apps/<app>/...). Absent : le bouton décide l'action.
  lien?: string
}

// Un chemin de lien reste dans l'app d'origine : relatif, sans protocole, sans « .. », sans barre oblique double.
export function cheminLienValide(chemin: string, appOrigine: string): boolean {
  if (chemin.length === 0 || !chemin.startsWith("/") || chemin.startsWith("//")) return false
  if (chemin.includes("\\") || chemin.split("/").includes("..")) return false
  const base = `/apps/${appOrigine}`
  return chemin === base || chemin.startsWith(`${base}/`) || chemin.startsWith(`${base}?`)
}

// Motif de refus d'une charge <app>.action_requise dont un bouton-lien pointe hors de son app, ou null si la charge
// est acceptable. Appelé par emettre() : une charge refusée n'écrit rien.
export function motifLienRefuse(nom: string, donnees: Record<string, unknown>): string | null {
  if (!nom.endsWith(".action_requise") || !Array.isArray(donnees.boutons)) return null
  const appOrigine = nom.split(".")[0]
  for (const bouton of donnees.boutons as Array<Partial<BoutonAction>>) {
    if (bouton.lien === undefined) continue
    if (typeof bouton.lien !== "string" || !cheminLienValide(bouton.lien, appOrigine)) {
      return `Lien refusé pour « ${bouton.libelle ?? bouton.cle} » : un lien reste dans /apps/${appOrigine}.`
    }
  }
  return null
}

// Ce que fait un clic sur un bouton : « lien » (navigation seule), « decider » (décision), ou null (bouton absent).
export function effetDuBouton(boutons: readonly BoutonAction[], cle: string): "lien" | "decider" | null {
  const bouton = boutons.find((b) => b.cle === cle)
  if (!bouton) return null
  return bouton.lien !== undefined ? "lien" : "decider"
}

// Vrai si l'action n'a que des boutons-liens : aucun clic ne la décide, elle ne sort que par sa levée.
export function actionSansDecision(boutons: readonly BoutonAction[]): boolean {
  return boutons.length > 0 && boutons.every((b) => b.lien !== undefined)
}
