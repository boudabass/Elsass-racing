// Adresse publique des redirections. Derrière le proxy de Coolify, et en standalone avec
// HOSTNAME=0.0.0.0, l'origine vue par Next peut être http://0.0.0.0:3000 : une redirection
// bâtie sur cette origine enverrait le navigateur dans le vide. En production, la base est donc
// APP_URL ; en développement, l'origine de la requête (le port de dev, ou celui des tests).

export interface OrigineRequete {
  nextUrl: { origin: string }
}

export interface ParametresBase {
  enProduction: boolean
  appUrl: string | undefined
  origine: string | undefined
}

// Fonction pure : la base d'URL selon l'environnement.
export function baseUrlPublique({ enProduction, appUrl, origine }: ParametresBase): string {
  if (enProduction) {
    if (!appUrl) throw new Error("APP_URL absente en production : impossible de construire les redirections.")
    return appUrl.replace(/\/+$/, "")
  }
  return (origine ?? appUrl ?? "http://localhost:3000").replace(/\/+$/, "")
}

// Adresse absolue d'un chemin, sur le domaine public. `requete` est facultative : sans elle
// (hors requête), le développement se rabat sur APP_URL.
export function urlPublique(chemin: string, requete?: OrigineRequete): string {
  const base = baseUrlPublique({
    enProduction: process.env.NODE_ENV === "production",
    appUrl: process.env.APP_URL,
    origine: requete?.nextUrl.origin,
  })
  return new URL(chemin, base).toString()
}
