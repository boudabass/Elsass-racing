// Service worker de l'app, écrit à la main (pas de bibliothèque). La version est injectée au build
// (cf. next.config.ts, VERSION_APP) : un nouveau build crée un nouveau cache.
//
// Stratégies :
// - _next/static et icônes : cache d'abord (contenu immuable, nommé par hash).
// - pages (navigations) : réseau d'abord, copie en cache quand la réponse est une page HTML ;
//   hors ligne, la copie en cache, sinon la page /hors-ligne.
// - /api/ : jamais en cache, jamais interceptée.

export function codeServiceWorker(version: string): string {
  return SOURCE.replace("__VERSION__", version)
}

const SOURCE = `
var VERSION = "__VERSION__";
var CACHE = "elsass-racing-" + VERSION;
var PRECACHE = ["/hors-ligne", "/manifest.webmanifest", "/icones/icone-192.png", "/icones/icone-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cles) {
      return Promise.all(
        cles
          .filter(function (cle) { return cle.indexOf("elsass-racing-") === 0 && cle !== CACHE; })
          .map(function (cle) { return caches.delete(cle); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var requete = event.request;
  var url = new URL(requete.url);
  if (requete.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/api/") === 0) return;

  if (url.pathname.indexOf("/_next/static/") === 0 || url.pathname.indexOf("/icones/") === 0) {
    event.respondWith(cacheDabord(requete));
    return;
  }
  if (requete.mode === "navigate") {
    event.respondWith(reseauDabord(requete));
  }
});

function cacheDabord(requete) {
  return caches.match(requete).then(function (trouvee) {
    if (trouvee) return trouvee;
    return fetch(requete).then(function (reponse) {
      if (reponse.ok) {
        var copie = reponse.clone();
        caches.open(CACHE).then(function (cache) { cache.put(requete, copie); });
      }
      return reponse;
    });
  });
}

function reseauDabord(requete) {
  return fetch(requete).then(function (reponse) {
    var type = reponse.headers.get("content-type") || "";
    if (reponse.ok && type.indexOf("text/html") === 0) {
      var copie = reponse.clone();
      caches.open(CACHE).then(function (cache) { cache.put(requete, copie); });
    }
    return reponse;
  }).catch(function () {
    return caches.match(requete).then(function (trouvee) {
      return trouvee || caches.match("/hors-ligne");
    });
  });
}
`
