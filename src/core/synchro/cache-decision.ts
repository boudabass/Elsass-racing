// Décision du service worker : faut-il copier cette réponse dans le cache ?
// Fonction pure et autonome (aucune dépendance) : elle est injectée telle quelle dans le code du
// service worker (cf. service-worker.ts), et testée ici à l'identique.
//
// Une page redirigée n'est jamais copiée : après expiration de session, /qg redirige vers /connexion,
// et la page de connexion ne doit pas être resservie hors ligne à la place du QG.

export interface ReponseCachable {
  ok: boolean
  redirected: boolean
  contentType: string
}

export function doitMettreEnCache(reponse: ReponseCachable): boolean {
  return reponse.ok && !reponse.redirected && reponse.contentType.indexOf("text/html") === 0
}
