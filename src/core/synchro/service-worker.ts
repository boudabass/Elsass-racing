// Service worker de l'app, écrit à la main (pas de bibliothèque). La version est injectée au build
// (cf. next.config.ts, VERSION_APP) : un nouveau build crée un nouveau cache.
//
// Stratégies :
// - _next/static et icônes : cache d'abord (contenu immuable, nommé par hash).
// - pages (navigations) : réseau d'abord, copie en cache quand la réponse est une page HTML non
//   redirigée. Hors ligne : la copie de la page, paramètres ignorés (/notes?nouvelle=1 sert /notes),
//   sinon une page de repli sans JavaScript (un JavaScript absent du cache ferait planter la page).
// - requêtes RSC (navigations client de Next) : pas d'intervention. Hors ligne, elles échouent
//   nativement, et Next retombe sur une navigation de page, que le service worker sert.
// - /api/ : jamais en cache, jamais interceptée.
// - message « precharger » : le client demande la mise en cache de pages clés, en ligne.

import { doitMettreEnCache } from "./cache-decision"

export function codeServiceWorker(version: string): string {
  return "var doitMettreEnCache = (" + doitMettreEnCache.toString() + ");\n" + SOURCE.replace("__VERSION__", version)
}

const SOURCE = `
var VERSION = "__VERSION__";
var CACHE = "elsass-racing-" + VERSION;
var PRECACHE = ["/manifest.webmanifest", "/icones/icone-192.png", "/icones/icone-512.png"];
var PAGE_HORS_LIGNE = "<!doctype html><html lang='fr'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Pas de réseau</title></head><body style='margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0b0b0c;color:#f4f4f5;font-family:sans-serif;text-align:center;padding:24px'><h1 style='font-size:28px;margin:0'>Pas de réseau</h1><p style='color:#a1a1aa;margin:0;max-width:24rem'>Les données déjà synchronisées restent disponibles dans le QG.</p><a href='/qg' style='color:#fff;background:#d7141a;padding:10px 20px;border-radius:6px;text-decoration:none'>Retour au QG</a></body></html>";

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

self.addEventListener("message", function (event) {
  var donnees = event.data || {};
  if (donnees.type !== "precharger" || !Array.isArray(donnees.urls)) return;
  event.waitUntil(precharger(donnees.urls));
});

function precharger(chemins) {
  return Promise.all(chemins.map(function (chemin) {
    return fetch(chemin, { credentials: "same-origin", cache: "no-store" }).then(function (reponse) {
      var copiable = doitMettreEnCache({
        ok: reponse.ok,
        redirected: reponse.redirected,
        contentType: reponse.headers.get("content-type") || ""
      });
      if (copiable) {
        return caches.open(CACHE).then(function (cache) { return cache.put(chemin, reponse.clone()); });
      }
    }).catch(function () {});
  }));
}

self.addEventListener("fetch", function (event) {
  var requete = event.request;
  var url = new URL(requete.url);
  if (requete.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/api/") === 0) return;
  if (requete.headers.get("RSC") === "1") return;

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
    var copiable = doitMettreEnCache({
      ok: reponse.ok,
      redirected: reponse.redirected,
      contentType: reponse.headers.get("content-type") || ""
    });
    if (copiable) {
      var copie = reponse.clone();
      caches.open(CACHE).then(function (cache) { cache.put(requete, copie); });
    }
    return reponse;
  }).catch(function () {
    return caches.match(requete, { ignoreSearch: true }).then(function (trouvee) {
      if (trouvee) return trouvee;
      return new Response(PAGE_HORS_LIGNE, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    });
  });
}
`
