# Tests

Trois niveaux : unitaires, vérifications en base, bout en bout. Chacun se lance séparément.

## Unitaires (Vitest)

- Commande : `pnpm test` (`vitest run`). Fichiers `src/**/*.test.ts`, environnement node, aucune base.
- Couvre les fonctions pures : jetons et hachage, contraste des couleurs, niveaux de droits, dépendances des apps, règle du dernier responsable, libellés, catalogue des événements, grille du QG.
- Vitest ne lit pas `e2e/` (le motif `include` ne retient que `src/`).

## Vérifications en base

Scripts tsx qui se connectent à la base locale. Ils créent des données de test et les suppriment dans un `finally`.

- `pnpm db:verifier-rls` : cloisonnement par team (lecture, écriture, insertion inter-teams refusées), et RLS activé sur toute table publique qui porte `team_id`. Étendu à Saison : RLS forcé, politique et droits des douze tables `saison_`, cloisonnement d'un championnat.
- `pnpm db:verifier-bus` : bus d'événements, livraisons, gestionnaires du socle. Étendu à Saison : engagement puis paiement, destinataires exacts (`docs/schema-saison.md`). Étendu en 2.4 : signaux de préparation, refus de décision avec motif gardé, relance de validation après 48 heures.

Pré-requis : `pnpm db:up`, puis `pnpm db:deploy` si la base est neuve.

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
