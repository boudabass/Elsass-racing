# Page partenaire : relecture de sécurité (brief 3.7, §7)

Première page de l'application servie **sans compte**. Ce document liste les risques, la protection mise en place, et le test qui la vérifie. Il sert à la relecture de l'orchestrateur. Les écarts au brief sont dits à la fin, sans les masquer.

## Vue d'ensemble

- Adresse : `/p/<jeton>`, hors du groupe `(app)`, sous `src/app/p/`.
- Jeton : 32 octets aléatoires, en base64url (43 caractères), généré par `genererJeton` (`src/apps/partenaires/jeton-serveur.ts`). Le jeton en clair n'est donné qu'à la création ou au renouvellement, une seule fois. La base ne garde que son empreinte SHA-256 (`empreinteJeton`, `src/apps/partenaires/empreinte-jeton.ts`).
- Revalidation : à chaque requête, le middleware (`src/middleware.ts`, runtime Node) puis la page ou la route de fichier appellent `trouverLienPublic` (`src/apps/partenaires/lien-public.ts`), qui passe par la fonction SQL `partenaires_lien_par_empreinte` (SECURITY DEFINER, migration `20261018163000_partenaires_lien_public`).
- Contexte de lecture : `avecContextePublic(teamId, …)` (`src/lib/prisma.ts`) pose seulement `app.team_id`. Pas d'utilisateur. Chaque lecture filtre en plus par le partenaire du lien (`page-publique-serveur.ts`).

## Risques

### 1. Jeton deviné ou énuméré

- **Protection** : 256 bits d'aléa. Un format invalide (longueur, caractères) est refusé avant toute requête. Au-delà de 30 jetons invalides par IP en 10 minutes, le middleware répond 429 avec `Retry-After: 600` (`LimiteTentatives` dans `limite-tentatives-serveur.ts`, clé = IP via `ipClient`).
- **Test** : e2e `e2e/partenaire-page.spec.ts`, test 8 (30 × 404, puis 429 au 31e). Unitaire : `src/apps/partenaires/jeton-serveur.test.ts`, `src/lib/ip-client.test.ts`.

### 2. Jeton qui fuit

- **Referer** : `Referrer-Policy: no-referrer` sur la page (en-tête middleware et `metadata.referrer` de `src/app/p/layout.tsx`) et sur les fichiers. Test : e2e test 5.
- **Journaux serveur** : le middleware n'écrit aucune ligne, et le jeton n'entre dans aucun message. Contrôle : après le run complet, le fichier `.e2e-stockage/jetons-de-test.txt` liste les jetons de test ; leur grep dans le journal `[WebServer]` donne 0 (voir le compte-rendu). Test 12.
- **Historique et cache** : `Cache-Control: private, no-store` sur la page et les fichiers. Test 5.
- **Service worker** : `/p/` est exclu dans le fetch et dans `precharger` (`src/core/synchro/service-worker.ts`). Test : e2e test 9 (`caches.match` et clés de cache, aucune entrée `/p/`). Unitaire : `src/core/synchro/cache-decision.test.ts`.
- **Moteurs de recherche** : `X-Robots-Tag: noindex, nofollow` et `<meta name="robots" content="noindex, nofollow">` (layout `p`). Test 5 pour l'en-tête.
- **Base** : seule l'empreinte est stockée. Test : `scripts/verifier-cloisonnement.ts` (empreinte, rien pour un jeton inconnu) et l'e2e (`jetonEnClairEnBase` = 0, dans `partenaires.spec.ts`).
- **Reflet dans la réponse 404** : la page « lien non valide » reprend le chemin demandé dans le HTML de Next (données de rendu). Le jeton apparaît donc dans le corps de la 404, jamais en cache, jamais journalisé, sans effet sur les autres visiteurs. Voir les écarts.

### 3. Lien révoqué, renouvelé ou expiré encore lisible

- **Protection** : la fonction SQL ne renvoie une ligne que si `actif`, non supprimé et `expire_le` absent ou futur. Révoquer met `actif` à faux ; renouveler révoque l'ancien ; l'expiration est une date. Aucune copie hors ligne (`no-store`, service worker exclu).
- **Test** : e2e test 4 (révoqué, renouvelé et expiré renvoient 404 ; le nouveau marche).

### 4. Accès aux données d'un autre partenaire, d'une autre team, ou à un fichier changé

- **Protection** : la fonction SQL joint le lien au partenaire du même team ; le contexte public ne voit que la team du lien ; chaque lecture filtre par `partnerId` et `teamId`. Les fichiers ne sortent que s'ils appartiennent à une des cinq catégories permises par `lireFichierDuLien` : logo de la team, logo du partenaire, document signé d'une convention affichée, preuve visible, bilan (dans les sections cochées). Un identifiant de fichier d'un autre partenaire, d'une autre team, ou d'une preuve masquée donne `null`, comme un fichier absent.
- **Test** : e2e test 3 (document de B, preuve masquée de A, fichier de l'autre team : 404 ; document de A : 200). Contrôle base : `scripts/verifier-cloisonnement.ts` (une seule ligne renvoyée, colonnes exactes, aucune lecture de `partenaires_partner` sans contexte).

### 5. Élément interne affiché

- **Protection** : `page-publique-serveur.ts` ne lit ni le budget, ni les notes, ni les échanges, ni les membres hors signataires écrits, ni le statut de prospection, ni les brouillons (seuls les statuts de `STATUTS_CONVENTION_VISIBLES` passent), ni les preuves masquées, ni les résultats non publics ou non validés. La liste en tête du fichier le rappelle.
- **Test** : e2e test 1 (liste négative : brouillon, preuve masquée, résultat masqué, Garage Beta, « Budget »). Unitaire : `src/apps/partenaires/bilan.test.ts` (une preuve masquée n'entre pas dans le bilan, même passée en entrée).

### 6. Message abusif (spam, texte long, injection HTML)

- **Protection** : nom au plus 100 caractères, message au plus 2 000, vides refusés (`src/apps/partenaires/actions-public.ts`). Au plus 5 messages par lien et par heure (`LimiteTentatives`, en mémoire par instance). Champ piège `site` : rempli, succès apparent et rien n'est enregistré. Texte enregistré tel quel, affiché par React (échappé), jamais en HTML ; aucun lien rendu cliquable côté team (`OngletMessages`).
- **Test** : e2e test 7 (texte avec balise `img onerror` affiché comme texte, pas exécuté ; champ piège sans effet) et test 7 bis (limite de 5 messages par heure et par lien : le 6e est refusé, et rien n'est enregistré pour lui).

### 7. Différence de réponse entre « inconnu » et « révoqué »

- **Protection** : même statut 404, et même page « Lien non valide » (même `notFound` et même rewrite). Le corps ne varie qu'à cause du jeton lui-même, reflété.
- **Test** : e2e test 4 compare le corps de la 404 d'un lien révoqué et celui d'un jeton inventé (jeton remplacé des deux côtés).

### 8. Page servie dans un cadre

- **Protection** : `Content-Security-Policy: frame-ancestors 'none'` et `X-Frame-Options: DENY` (en-têtes du middleware, sur la page). Les fichiers ont `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, `X-Content-Type-Options: nosniff`.
- **Test** : e2e test 5 (frame-ancestors présent sur la page et sur un fichier).

### 9. Usurpation d'IP pour contourner la limite

- **Protection** : `ipClient` (`src/lib/ip-client.ts`) lit `x-real-ip` d'abord, sinon la **dernière** valeur de `x-forwarded-for` (celle ajoutée par le proxy le plus proche), jamais la première, qui vient du client. Utilisé aussi par la connexion.
- **Risque restant** : la confiance accordée à `x-real-ip` n'est sûre que si le proxy (Traefik sur Coolify) réécrit cet en-tête. **Non vérifié** depuis cet environnement. Sans cela, un client peut forger `x-real-ip` et contourner la limite de 30 jetons invalides. Le jeton reste de 256 bits : la force brute reste impraticable, mais la limite perd son effet. À vérifier sur Coolify avant la mise en production.
- **Test** : `src/lib/ip-client.test.ts` (4 cas, dont la dernière valeur de `x-forwarded-for`). L'e2e s'appuie sur `x-real-ip` pour isoler ses scénarios.

### 10. Session utilisée par la page publique

- **Protection** : la route `/p/` n'appelle ni la garde de session ni `prisma` authentifié ; le contexte public ne pose pas `app.user_id`.
- **Test** : e2e, chaque scénario visiteur tourne dans un contexte neuf, sans cookie (test 1 et suivants).

### 11. Script injecté (XSS)

- **Protection** : pas de script tiers, et la CSP limite les sources à `'self'`. Le message et les noms sont affichés comme texte.
- **Écart connu** : `script-src 'self' 'unsafe-inline'` est nécessaire, parce que Next injecte ses scripts d'amorçage en ligne. Une CSP sans `unsafe-inline` demanderait des nonces, à mettre en place plus tard. Voir les écarts.

## Écarts au brief, dits explicitement

1. **Alerte QG (fermé au lot 3, brief 3.8, point 0.3)** : le message lève `partenaires.action_requise` « Nouveau message de … » par le contexte système de la team (`contexteSysteme(teamId, "page_partenaire")`, voir plus bas). Destinataire : le membre qui suit le partenaire, ou les responsables s'il n'y a pas de suivi. Test : e2e test 7 (la boîte d'actions du suivi affiche l'alerte).
2. **Limite de 5 messages par heure (fermé au lot 3)** : test e2e 7 bis. Le compteur reste en mémoire et par instance (point 9).
3. **Confiance dans `x-real-ip`** : voir le risque 9. À vérifier sur Coolify.
4. **CSP `script-src 'unsafe-inline'`** : voir le risque 11.
5. **Corps de la 404 de fichier différent de la page 404** : `Fichier introuvable.` en texte pour la route de fichier, page HTML « Lien non valide » pour la page. Le statut est le même (404) dans tous les cas refusés.
6. **Reflet du jeton dans la 404** : voir le risque 2.
7. **Calendrier** : il liste le nom des épreuves de la saison, y compris celles dont le résultat est masqué. Le résultat, lui, est masqué (classement absent). Le brief ne dit pas de masquer le calendrier, mais la question peut se poser.
8. **Compteur de consultations** : la fiche affiche « Consultations : N. » et la date de la dernière, au lieu de « 1 consultation ». Un affichage recompte au plus une fois toutes les 30 minutes.
9. **Limites en mémoire** : `LimiteTentatives` (jetons invalides et messages) est par instance et repart à zéro au redémarrage. Suffisant pour une instance, pas une garantie multi-instances.
10. **En-tête `x-middleware-rewrite`** : visible dans la réponse (`/p/introuvable`). Il est identique pour tous les cas refusés, et ne révèle rien de plus.

## Contexte système (brief 3.8, point 0.3)

Solution retenue : **un contexte système sans fonction SQL**, `contexteSysteme(teamId, origine)` (`src/core/contexte-systeme-serveur.ts`). Le brief laissait le choix entre ce contexte et une fonction SQL étroite ; le choix est celui-ci, et voici pourquoi.

- **Pourquoi pas de fonction SQL** : les trois tables que le socle écrit pour un événement (`core_domain_event`, `core_event_delivery`, `core_action`) ont une politique RLS qui ne dépend que de `app.team_id` (migration `20261016144714`). Le contexte système ne pose que `app.team_id` : il n'ouvre aucun droit de membre, et il ne crée aucun utilisateur. Une fonction SQL n'aurait rien ajouté à cette garantie.
- **Garde-fous** :
  - seul le code serveur peut le fabriquer (`import "server-only"`) ;
  - l'origine doit figurer dans `ORIGINES_SYSTEME`, qui ne contient aujourd'hui que `page_partenaire` ; ajouter une origine est une décision de sécurité ;
  - l'événement n'a pas d'auteur (aucun `userId`) ; son origine est rangée dans ses données, à la clé `origine` (`src/core/evenements/bus-serveur.ts`) ;
  - le client Prisma est `prismaPourTeamSysteme(teamId)` (`src/lib/prisma.ts`), qui ne pose que `app.team_id`.
- **Limite connue** : le contexte ne limite pas ce que fait un gestionnaire. Un gestionnaire lancé par un événement de ce contexte agit avec les droits de la team, sans utilisateur. Seule l'origine `page_partenaire` existe aujourd'hui.
- **Test** : e2e test 7 (l'alerte arrive dans la boîte d'actions du suivi, sans utilisateur).
