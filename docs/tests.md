# Tests

Trois niveaux : unitaires, vérifications en base, bout en bout. Chacun se lance séparément.

## Où tournent les vérifications (tâche 4.0b)

Depuis la 4.0b, les vérifications lourdes tournent sur GitHub Actions, pas sur le poste : son poste ne supporte plus Docker, les builds et les passes e2e en plus du travail. Sur le poste, il ne reste que `pnpm typecheck` et `pnpm test`. Plus de `db:up`, de `db:verifier-*`, de build ni d'e2e en local.

Le workflow est `.github/workflows/verifications.yml`, en deux jobs :
- `rapide` (environ 3 min) : installation, typecheck, tests unitaires.
- `complet` (après `rapide`) : PostgreSQL 18 en service, rôle applicatif créé comme `docker/init/01-role-app.sql`, `db:deploy`, `db:seed`, `db:verifier-rls`, `db:verifier-bus`, `db:verifier-synchro`, `db:verifier-garage`, puis `pnpm test:e2e` sur le build de production (port 3101), comme en local.

Déclenchement : push sur `verif`, `dev` et `main`, ou à la main (onglet Actions, « Vérifications », Run workflow). Pour un seul spec à la main, renseigner le champ `e2e` (par exemple `e2e/garage.spec.ts`).

La branche `verif` est le contrôle avant `dev`. Coolify ne déploie que `dev` et `main` : pousser sur `verif` ne touche pas à l'app dev. On ne pousse sur `dev` qu'une fois `verif` vert, avec le feu vert de l'orchestrateur.

Lire un résultat avec `gh` :
- `gh run list --workflow verifications.yml --branch verif` : les dernières exécutions ;
- `gh run watch <id>` : suivre une exécution ; `gh run view <id> --log-failed` : les lignes en échec ;
- le résumé du job (en haut de la page de l'exécution) donne le nombre de lignes `ECONNRESET` et `uncaughtException` du journal serveur, le bilan Playwright et les captures modifiées.

Traces d'un échec : artefact `traces-echec` (rapport Playwright, `test-results/`, `journal-serveur.log`), gardé 7 jours. Téléchargement : `gh run download <id> -n traces-echec -D traces-ci`.

Captures : artefact `captures`, généré par le même build que la suite. Le dépôt n'est pas modifié par la CI. Pour les garder : `gh run download <id> -n captures -D captures-ci`, relire les images, les copier dans `docs/captures/`, puis committer à la main.

Secrets : aucun secret de production ni de dev dans GitHub. La base est un service jetable du runner, `SESSION_SECRET` est tiré au sort à chaque exécution.

Les consignes de passes locales plus bas dans ce fichier datent d'avant la 4.0b. Elles restent en historique et ne s'appliquent plus sur le poste.

### Intermittent suivi : `e2e/hors-ligne.spec.ts:87`

- Test : « hors ligne : + puis Note depuis le QG ouvre les notes sans erreur ».
- Échec sur le run 39471174537 (commit 9fbead9) : erreur React #418 (hydratation, HTML). Elle arrive au **premier chargement en ligne de `/qg`**, avant la phase hors ligne : le test collecte les erreurs de page depuis son début, d'où un nom trompeur.
- Référence verte : run 39474476309 (commit 8b7d693), 136 tests passés sur 136.
- Cause non établie. Le HTML serveur de `/qg` et le DOM client ont la même séquence de textes : la différence est ailleurs (attribut, nœud non textuel).
- Suivi sur les prochains runs. Si le 418 revient : étape de diagnostic dans un commit séparé, hors du test, qui capte le HTML serveur et le DOM client de `/qg` (attributs de `<html>` et `<body>`, thème, indicateur « il y a N min »). Renommage ou séparation des erreurs « en ligne » et « hors ligne » : après la cause.

## Unitaires (Vitest)

- Commande : `pnpm test` (`vitest run`). Fichiers `src/**/*.test.ts`, environnement node, aucune base.
- Couvre les fonctions pures : jetons et hachage, contraste des couleurs, niveaux de droits, dépendances des apps, règle du dernier responsable, libellés, catalogue des événements, grille du QG.
- Vitest ne lit pas `e2e/` (le motif `include` ne retient que `src/`).

## Vérifications en base

Scripts tsx qui se connectent à la base locale. Ils créent des données de test et les suppriment dans un `finally`.

- `pnpm db:verifier-rls` : cloisonnement par team (lecture, écriture, insertion inter-teams refusées), et RLS activé sur toute table publique qui porte `team_id`. Étendu à Saison : RLS forcé, politique et droits des douze tables `saison_`, cloisonnement d'un championnat.
- `pnpm db:verifier-bus` : bus d'événements, livraisons, gestionnaires du socle. Étendu à Saison : engagement puis paiement, destinataires exacts (`docs/schema-saison.md`). Étendu en 2.4 : signaux de préparation, refus de décision avec motif gardé, relance de validation après 48 heures.

Pré-requis : `pnpm db:up`, puis `pnpm db:deploy` si la base est neuve.

## Vérifier sans saturer la mémoire

Trois niveaux, du plus léger au plus lourd. On ne monte d'un niveau que si le précédent ne suffit pas.

1. **Sans serveur** (par défaut, après chaque tâche) : `pnpm typecheck`, `pnpm test`, `pnpm db:verifier-rls`, `pnpm db:verifier-bus`, `pnpm db:verifier-synchro`.
2. **Sur l'app dev déployée** : après le push sur dev, Coolify construit l'app. On contrôle en HTTP ou à la main sur https://elsass-racing-dev.theelsassisch.com. Rien à lancer en local.
3. **E2E local ciblé** : `pnpm test:e2e e2e/<fichier>.spec.ts`, seulement les fichiers touchés. La suite complète (`pnpm test:e2e`) est réservée à l'orchestrateur, avant une fusion dans main.

Règles pour l'opérateur :
- Une seule passe à la fois. Avant de lancer un build ou un e2e, vérifier que le port 3101 est libre (Playwright refuse de démarrer s'il est occupé : ne pas relancer, nettoyer).
- À la fin de chaque tâche, et après tout échec ou interruption : `pnpm nettoyer:serveurs`. Il arrête le port 3101, les `next build`, `playwright` et les Chromium de Playwright, et épargne le serveur de John (port 3000).

## Bout en bout (Playwright)

- Commande : `pnpm test:e2e` (`playwright test`). Premier passage sur un poste : `pnpm exec playwright install chromium`.
- Configuration : `playwright.config.ts`. Projets `chromium` et `hors-ligne`, un seul worker. Un seul serveur, lancé par Playwright : le build de production (`next build` puis `next start --port 3101`, `NEXT_DIST_DIR=.next-e2e-prod`, `SMTP_HOST` vide, `E2E=1`). Avec `E2E=1`, les mails s'affichent dans la console et `/erreur-test` existe. `reuseExistingServer: false` : le serveur de développement du port 3000 n'est jamais utilisé ni arrêté. L'ancien serveur `next dev` du port 3100 a été retiré le 17/10/2026 : il dépassait plusieurs Go et se relançait en pleine suite.
- Rapport HTML : `playwright-report/` ; traces et captures d'échec : `test-results/`. Ces deux dossiers et `.next-e2e` sont ignorés par git et par Docker.

### Connexion de test sans porte dérobée

`e2e/aide/session.ts` crée, avec le rôle propriétaire (`DATABASE_URL_MIGRATION`) :

- une team « E2E <horodatage> » (slug `e2e-<horodatage>`) avec ses 11 apps activées,
- un compte responsable `e2e-<horodatage>@example.test`,
- un jeton de lien dont le secret est généré par le test et haché comme l'app (`hacherSecret`, de `src/core/auth/jetons.ts`).

Le test visite `/connexion/lien?t=<secret>`. Le code (étape « code » du formulaire) passe par un jeton au code connu, ajouté par l'aide avec `hacherCode`. Rien n'est ajouté au code de l'application pour les tests.

La fixture `e2e/aide/fixtures.ts` supprime la team à la fin de chaque scénario, même en cas d'échec : toutes les tables qui portent `team_id`, la team, puis les comptes de test. La suppression désactive les clés étrangères le temps d'une transaction (`session_replication_role = replica`), ce qui exige le rôle propriétaire, superutilisateur en développement.

Les écritures de l'aide sont en SQL direct (`pg`). Le client Prisma généré est un module ESM, que le chargeur de Playwright ne lit pas. L'émission de `saison.action_requise` passe par le vrai bus, dans un processus `tsx` (`e2e/aide/emettre-action.ts`).

### Scénarios

| Fichier | Scénario |
|---|---|
| `e2e/connexion.spec.ts` | a. connexion par lien ; b. connexion par code ; c. déconnexion par le menu |
| `e2e/identite.spec.ts` | d. couleur enregistrée, relue après rechargement, événement `settings.identite_modifiee` en base |
| `e2e/apps.spec.ts` | e. désactiver Garage retire sa tuile ; la réactiver ; Voiture refusée (« Requise par Garage ») |
| `e2e/droits.spec.ts` | f. écart surligné pour un équipier, puis « Revenir aux droits du rôle » |
| `e2e/actions.spec.ts` | g. décider une action depuis la boîte : statut `decidee` en base, action disparue |
| `e2e/terrain.spec.ts` | h. mode terrain : classe `terrain` sur `<html>`, `settings_member_pref.mode_terrain` vrai |
| `e2e/telephone.spec.ts` | i. viewport 360×740 : pas de défilement horizontal, barre basse visible |
| `e2e/reglages-personnels.spec.ts` | thème clair persisté et présent dans le HTML du serveur ; déconnexion de l'appareil courant ; suppression de compte refusée au responsable seul, puis demandée et annulée par un équipier (contrôle en base) ; quitter une team refusé au dernier responsable ; assistance : rubriques personnelles ouvertes, celles de la team refusées |
| `e2e/prochaine-etape.spec.ts` | le bouton Prochaine étape affiche « Valider le résultat du Gaschney », son lien ouvre la boîte sur cette action, qui est dans la zone visible |
| `e2e/captures.spec.ts` | captures pleine page et boîte d'actions, sur une team avec les données de démonstration |
| `e2e/deploiement.spec.ts` | `/api/sante` répond 200 `{ ok: true }` ; sans session, `/qg` et un lien invalide redirigent vers une adresse sur l'origine publique |
| `e2e/hors-ligne.spec.ts` | projet `hors-ligne`, serveur de production (port 3101, `.next-e2e-prod`, `next build` puis `next start`). Connexion, note en ligne, visite de `/qg` et `/notes`, passage hors ligne, rechargement depuis le cache du service worker, note hors ligne (badge « En attente », indicateur « 1 modification en attente »), retour du réseau et présence en base. Second test : sans rechargement, la note part au retour du réseau. Troisième et quatrième tests (1.11b) : « + » puis « Note » depuis le QG hors ligne ouvre les notes sans erreur, puis la création fonctionne ; une app jamais visitée hors ligne affiche la page de repli, sans écran d'erreur |
| `e2e/erreurs.spec.ts` | écran d'erreur en français sur `/erreur-test` (hors production, ou build de test avec `E2E=1`), avec envoi au journal (204) ; le journal refuse un envoi sans session (401) |

Synchro hors ligne : unitaires `src/core/synchro/*.test.ts` (curseur, conflit, contribution, attente, protocole) ; base `pnpm db:verifier-synchro` (deux appareils simulés, conflit journalisé, rejeu idempotent, table refusée, isolement entre teams, contribution, nettoyage final). Étendu à Saison (2.4) : registre, tables en lecture seule refusées, sortie de l'équipage, débrief jamais reçu par l'assistance, saison clôturée refusée. Détails : `docs/synchro.md`.

Tests unitaires ajoutés pour le déploiement : `src/lib/url-publique.test.ts` (base des redirections selon l'environnement, refus de la production sans `APP_URL`), `src/lib/stockage.test.ts` (dossier des fichiers), `src/core/catalogue-sql.test.ts` (la dernière migration `_core_catalogue` est exactement le SQL généré depuis le catalogue), `src/lib/sante.test.ts` (décision de santé : la première étape en échec donne la raison). `src/lib/sante-decision.ts` est séparé de `sante.ts` pour rester testable sans base.

Pour le scénario e, le bouton « Désactiver » de Voiture est désactivé par l'interface quand Garage la requiert. Le test vérifie ce blocage et le message, sans tenter le clic.

### Captures

`docs/captures/` : `qg-1440x900.png`, `qg-360x740.png`, `identite-1440x900.png`, `boite-actions-1440x900.png` (pleines pages), et `qg-ecran-1440x900.png`, `qg-ecran-360x740.png` (fenêtre seule, le bouton Prochaine étape visible). Sur les fenêtres seules, seul l'indicateur de développement de Next est masqué. Pour une capture pleine page, la barre basse et les éléments fixes sont posés en absolu au bas du document, et l'indicateur de développement de Next est masqué. Seul le rendu de la capture change.

La team des captures reçoit les données de démonstration Koehling (`e2e/aide/donnees-equipe.ts`, qui réutilise `scripts/lib/donnees-koehling.ts`), plus une alerte orange sur Garage et l'action « Valider le résultat du Gaschney » en priorité 3. Le compte à rebours, le badge et la pastille des tuiles, et le bouton Prochaine étape apparaissent ainsi sur les captures.

### Aide : membres supplémentaires

`ajouterEquipier` (équipage, sans lien de connexion) et `ajouterMembreConnectable` (équipage ou assistance, avec un lien de connexion) ajoutent un membre à la team de test. Ils sont nettoyés avec elle. `compterSuppressions` lit les demandes de suppression en base.

## Enchaînement recommandé

```
pnpm typecheck
pnpm test
pnpm db:verifier-rls
pnpm db:verifier-bus
pnpm test:e2e
```

## Journal serveur pendant l'e2e : connexions coupées par le client (brief 3.8, point 0.6)

Pendant `pnpm test:e2e`, le journal du serveur (`[WebServer]`) reçoit deux sortes de lignes pour une requête que le client
a coupée : `[Error: aborted] { code: 'ECONNRESET' }`, puis `uncaughtException: [Error: aborted]`. Elles viennent de Node et
de Next, pas du code de l'app : Next installe un `process.on('uncaughtException')` qui les journalise et laisse le serveur
tourner (`node_modules/next/dist/server/next-server.js`).

**Ce qui est vérifié** (serveur de production local, port distinct, `.next-e2e-prod`) :

| Expérience | Résultat |
|---|---|
| 5 GET complets (`/api/sante`, `/connexion`) | 0 ligne |
| 40 GET coupés, avant ou après les en-têtes (`/api/sante`, `/connexion`) | 0 ligne |
| 3 chargements Chromium complets puis fermés, et 6 navigations coupées (page fermée pendant le chargement, navigation suivante) | 0 ligne |
| 5 réponses en flux coupées (un gros fragment JavaScript statique) | 0 ligne |
| 5 POST à corps incomplet vers `/api/synchro/pousser` | 10 lignes `ECONNRESET` (deux par requête), 0 `uncaughtException` |
| 5 POST à corps incomplet vers `/connexion` | 0 ligne |

Dans la route `/api/synchro/pousser`, la lecture du corps échoue déjà proprement (`requete.json().catch(() => null)`, réponse
400) : l'erreur `aborted` est donc émise par Node avant que l'app ne réponde, et Next la journalise. Le serveur répond
ensuite normalement (`/api/sante` : 200 après chaque série).

**Ce qui n'est pas expliqué** : les lignes `uncaughtException` du run complet (environ 300) n'ont pas été reproduites
par ces expériences. Elles restent comptées à part. Pas de preuve qu'elles viennent d'un défaut de l'app ; leur source
exacte n'est pas identifiée.

**Mise à jour (run complet du 18/10/2026, 116 tests, tous verts)** : 654 lignes `ECONNRESET` et 327 `uncaughtException`.
Une cause est maintenant prouvée pour une partie d'entre elles : dans `e2e/lot3-parcours.spec.ts`, un clic « Ajouter » dans
la boîte d'actions suivi d'une navigation immédiate a coupé la requête de décision. Côté serveur, la requête est
`aborted` ; la décision n'a jamais été enregistrée (aucun `core.action_decidee`). Le test attend désormais que le réseau
soit au repos avant de naviguer. Les autres lignes restent non expliquées.

**Consigne** : un simple affichage de page ne produit aucune de ces lignes (expérience des 3 chargements complets, 0 ligne).
Ne pas chercher à les supprimer dans l'app tant qu'elles ne viennent pas d'un défaut prouvé.

## Connexions coupées : qui les coupe (brief 3.9, §7)

Mesure sur `e2e/lot3-parcours.spec.ts` (1 test), serveur de test (`next start`, port 3101), avec un hook Node
temporaire chargé par `NODE_OPTIONS` (fichier hors dépôt, rien de committé, aucun code de l'app modifié). Le hook note
chaque requête à sa fermeture : méthode, chemin (jetons masqués), genre (page, RSC, prefetch, server action, API, fichier,
statique), réponse entièrement écrite ou non, et chaque `uncaughtException`.

| Run | Requêtes observées | Coupées | dont POST `/api/synchro/tirer` | dont préchargements RSC | `uncaughtException` |
|---|---|---|---|---|---|
| 1 | 1 059 | 26 | 23 | 3 | 23 |
| 2 | 1 068 | 25 | 22 | 3 | 22 |

Dans le run 2, chaque `uncaughtException` tombe à ±1 ms de la fermeture d'un POST `/api/synchro/tirer` coupé : 22 sur 22.
Aucune exception n'est liée à un préchargement coupé. Aucune server action et aucun envoi ou téléchargement de fichier
n'a été coupé (0 dans les deux runs). Les 3 préchargements coupés sont des GET RSC (`/apps/partenaires`, `/apps/saison`,
`/apps/checklist`) quittés par la navigation suivante. Aucun POST `/api/synchro/pousser` coupé dans ce spec.

**Cause côté client** : le moteur de synchro (`src/core/synchro/client/moteur.ts`) interroge `/api/synchro/tirer` avec un
`setInterval` et tire page après page. `appeler()` n'a pas de `AbortController`. Quand le test navigue pendant un tirage,
le navigateur annule la requête en vol ; le serveur écrit quand même sa réponse, qui n'arrive jamais. Node émet alors
`aborted`, et Next journalise `ECONNRESET` puis `uncaughtException`.

**Effet sur les données : aucun aujourd'hui.** `memoriserSynchro` écrit le curseur de l'appareil avant d'envoyer la
réponse, mais `coreSyncCursor` n'est lu nulle part dans `src` (écriture seule). Le client renvoie toujours son propre
curseur : un tirage coupé est refait au tirage suivant, sans perte. À revoir si l'on lit un jour ce curseur côté serveur.

Pas de correction dans l'app pour ce lot (consigne : ne pas supprimer les lignes sans défaut prouvé). Le run complet de
§8 est repris avec le même hook pour classer ses propres coupures.

## Suite complète du brief 3.9 (§8)

- `pnpm typecheck` : sans erreur. `pnpm test` (vitest) : 594/594, 69 fichiers. `db:verifier-rls`, `db:verifier-bus` et `db:verifier-synchro` : tous les contrôles passent. Build isolé (`NEXT_DIST_DIR=.next-build`) : vert.
- `pnpm test:e2e` complet (`DEBUG=pw:webserver`, journal serveur dans un fichier) : **119 passed** (12,6 min). Les 3 tests de `e2e/lot3-verifications.spec.ts` (historique Voiture, papiers, résultat annulé) sont inclus ; `e2e/lot3-parcours.spec.ts` couvre la fonction de l'interlocuteur (étape 3) et le bouton « Encaisser » (étape 8).
- Journal serveur de ce run : P2003 0, P2025 0, `reading 'id'` 0, ErreurAcces 0, TypeError 0. ECONNRESET 686, `uncaughtException` 343 (3.8 : 654 et 327). Jetons de 43 caractères : **1**. C'est l'URL `/connexion/lien?t=…` d'un mail de connexion de test, que le build de test écrit dans la console (`envoyerMail`, `src/core/auth/jetons-serveur.ts`). Le compteur attendu est 0 : à traiter, pas masqué.
- Coupures côté serveur pendant ce run (hook Node temporaire hors dépôt, même méthode qu'au §7) : 16 996 requêtes observées, 457 coupées.
  - 343 POST `/api/synchro/tirer` coupés, pour 343 `uncaughtException` : même nombre. Le rapprochement à la milliseconde n'a été vérifié que sur `lot3-parcours` (§7) ; il n'est pas refait ici.
  - **10 server actions coupées** (POST multipart, réponse non écrite) : `/apps/budget` (4), `/qg` (2), `/apps/voiture/vehicules/<id>` (4). **Escaladé à l'orchestrateur, non corrigé** : on ne sait pas, à partir du journal, si l'action a été exécutée côté base avant la coupure.
  - 0 envoi ou téléchargement de fichier coupé.
  - 114 autres coupures : 65 préchargements RSC, 5 requêtes RSC, 34 GET de navigation, 10 server actions (ci-dessus).
- Captures : `lot3-budget-encaisser-1440x900.png`, `lot3-budget-recette-encaissee-1440x900.png` (1440) et `…-360x740.png` (360), `lot3-fiche-qualite-1440x900.png`, `lot3-convention-apport-partiel-1440x900.png` (1440), `lot3-convention-actions-360x740.png` (360). Captures régénérées par le run et non liées au lot : restaurées à leur version commitée. **Non fait** : la capture de la boîte d'actions avec un groupe de deux éléments (brief §8).

## Journal serveur : `aborted ECONNRESET`, cause et suite (tâche 4.0)

Relecture du code et des journaux des passes 2 à 6 (20/10/2026), sans nouvelle passe.

- **Mesure.** Journaux `test-results/passe-{2,3,4,5,6}-journal.log` : ECONNRESET 438, 168, 114, 66, 72 ; `uncaughtException` 219, 84, 57, 33, 36. Le ratio est toujours 2:1 : une requête coupée donne une ligne `[Error: aborted] { code: 'ECONNRESET' }` puis une ligne `uncaughtException`. Selon la passe, c'est donc 66 à 438 lignes, et non une cinquantaine.
- **Route.** Seul `POST /api/synchro/tirer` produit ces lignes en régime normal. Au 3.9, 343 tirages coupés pour 343 `uncaughtException` (686 ECONNRESET), et les 114 autres coupures (préchargements RSC, navigations, server actions) ne produisent aucune ligne. `POST /api/synchro/pousser` ne les produit que si le corps est incomplet (3.8).
- **Cause.** `appeler()` dans `src/core/synchro/client/moteur.ts` envoie les tirages sans `AbortController`. Quand la page change (navigation, fermeture du contexte Playwright), le navigateur annule la requête en vol, et le serveur voit la connexion fermée avant la réponse. Un `AbortController` côté client n'y changerait rien : la fermeture de connexion est la même. Il n'a donc pas été ajouté.
- **Où part l'exception.** La route lit le corps avec `requete.json().catch(() => null)` (`src/app/api/synchro/tirer/route.ts`), et ne répond que par un `NextResponse` (`src/core/synchro/reponses.ts`). Rien dans ce code ne lève d'exception non gérée. Next écoute déjà l'erreur de la requête (`node_modules/next/dist/server/base-http/node.js`, méthode `stream()`) et la transmet au flux. L'événement exact qui devient `uncaughtException` n'a pas été identifié : d'après la lecture du code, il vient de Node ou de Next, pas de l'app. Ce point n'est pas prouvé par instrumentation.
- **Effet sur les données : aucun.** Côté client, le curseur n'avance qu'après lecture complète de la réponse (`tirer()`), donc un tirage coupé est refait. Côté serveur, `tirerPaquets` ne fait que lire ; `memoriserSynchro` écrit `derniereSyncAt` et le curseur, qui n'est relu nulle part côté serveur. Pour la poussée, `coreSyncOperation` dédoublonne par `idOperation` (`src/core/synchro/pousser.ts`) : une opération repartie après une coupure n'est pas doublée.
- **Décision.** Rien n'est masqué dans le journal et le code de synchro n'est pas modifié. Les lignes restent comptées à part.
- **Point ouvert.** Les 10 server actions coupées au 3.9 : on ne sait toujours pas si elles ont été exécutées avant la coupure. Non traité ici.
