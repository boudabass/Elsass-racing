// Journal des erreurs côté client. Une erreur part vers le serveur (les logs, visibles dans Coolify) ;
// hors ligne, elle est gardée sur l'appareil et envoyée au retour du réseau. Aucune donnée de la team
// dans le message : le texte de l'erreur, sa pile tronquée, la page (chemin seul), la version, le navigateur.

export const LIMITE_PILE = 2000
export const LIMITE_MESSAGE = 500
export const LIMITE_EN_ATTENTE = 50

export interface ErreurClient {
  message: string
  pile: string
  page: string
  version: string
  navigateur: string
  enLigne: boolean
  date: string
}

export interface ContexteErreur {
  page: string
  version: string
  navigateur: string
  enLigne: boolean
  date: string
}

// Fonction pure : met en forme une erreur, pile et message tronqués.
export function preparerErreur(erreur: { message?: string; stack?: string }, contexte: ContexteErreur): ErreurClient {
  return {
    message: (erreur.message || "Erreur inconnue").slice(0, LIMITE_MESSAGE),
    pile: (erreur.stack || "").slice(0, LIMITE_PILE),
    page: contexte.page,
    version: contexte.version,
    navigateur: contexte.navigateur,
    enLigne: contexte.enLigne,
    date: contexte.date,
  }
}

const CLE_EN_ATTENTE = "elsass-racing-erreurs-en-attente"

// Erreurs gardées sur l'appareil : les plus anciennes sortent quand la liste est pleine.
export function ajouterEnAttente(erreurs: ErreurClient[], nouvelle: ErreurClient): ErreurClient[] {
  return [...erreurs, nouvelle].slice(-LIMITE_EN_ATTENTE)
}

export function lireEnAttente(): ErreurClient[] {
  try {
    const brut = window.localStorage.getItem(CLE_EN_ATTENTE)
    return brut ? (JSON.parse(brut) as ErreurClient[]) : []
  } catch {
    return []
  }
}

function ecrireEnAttente(erreurs: ErreurClient[]): void {
  try {
    window.localStorage.setItem(CLE_EN_ATTENTE, JSON.stringify(erreurs))
  } catch {
    // Stockage plein ou désactivé : l'erreur est perdue, sans conséquence pour l'app.
  }
}

function contexteCourant(): ContexteErreur {
  return {
    page: window.location.pathname,
    version: process.env.VERSION_APP || "dev",
    navigateur: window.navigator.userAgent.slice(0, 300),
    enLigne: window.navigator.onLine,
    date: new Date().toISOString(),
  }
}

// Envoie une erreur, ou la garde si le réseau manque ou si l'envoi échoue.
export async function journaliserErreur(erreur: { message?: string; stack?: string }): Promise<void> {
  const erreurPreparee = preparerErreur(erreur, contexteCourant())
  if (!(await envoyer(erreurPreparee))) {
    ecrireEnAttente(ajouterEnAttente(lireEnAttente(), erreurPreparee))
  }
}

// Renvoie les erreurs gardées, une à une. Celles qui partent sont retirées de la liste.
export async function envoyerErreursEnAttente(): Promise<void> {
  const erreurs = lireEnAttente()
  if (erreurs.length === 0) return
  const restantes: ErreurClient[] = []
  for (const erreur of erreurs) {
    if (!(await envoyer(erreur))) restantes.push(erreur)
  }
  ecrireEnAttente(restantes)
}

async function envoyer(erreur: ErreurClient): Promise<boolean> {
  if (!window.navigator.onLine) return false
  try {
    const reponse = await fetch("/api/erreurs-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(erreur),
      cache: "no-store",
      credentials: "same-origin",
    })
    return reponse.ok
  } catch {
    return false
  }
}
