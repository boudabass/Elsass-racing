# Tests

Trois niveaux : unitaires, vérifications en base, bout en bout. Chacun se lance séparément.

## Où tournent les vérifications (tâche 4.0b)

Depuis la 4.0b, les vérifications lourdes tournent sur GitHub Actions, pas sur le poste : son poste ne supporte plus Docker, les builds et les passes e2e en plus du travail. Sur le poste, il ne reste que `pnpm typecheck` et `pnpm test`. Plus de `db:up`, de `db:verifier-*`, de build ni d'e2e en local.

Le workflow est `.github/workflows/verifications.yml`, en deux jobs :
- `rapide` (environ 3 min) : installation, typecheck, tests unitaires.
- `complet` (après `rapide`) : PostgreSQL 18 en service, rôle applicatif créé comme `docker/init/01-role-app.sql`, `db:deploy`, `db:seed`, `db:verifier-rls`, `db:verifier-bus`, `db:verifier-synchro`, `db:verifier-garage`, puis `pnpm test:e2e` sur le build de production (port 3101), comme en local.

Minutes : le quota du plan Free (2 000 minutes par mois) a été épuisé le 23/10/2026, en trois jours de lot 4 (environ 80 runs de 25 minutes). Le dépôt est public depuis, ce qui rend les minutes illimitées sur les runners standard. Il repassera en privé après la V1 : il faudra alors limiter `verif` aux unitaires, aux `db:verifier-*` et aux specs de l'app touchée, et garder la suite complète pour l'envoi sur `dev`. Un push, un run : regrouper les commits avant de pousser. Le workflow ne se déclenche que sur push et à la main, jamais sur une pull request venue d'un fork.

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

### Erreur 418 au premier chargement en ligne de `/qg` (tâche 4.3c)

- Signature : `Minified React error #418` (hydratation : HTML serveur différent du DOM client), levée au premier chargement en ligne de `/qg`, avant toute action du test. Production seulement. **Cause non établie.**
- Fréquence : 11 runs rouges sur 23 entre la 4.0b et `3bf8f36` contiennent le 418 (8 sur `hors-ligne.spec.ts:87`, 3 sur `:119`). Décompte de 4.3b : 8 échecs sur 47 runs pour `:87` seul (17 %).
- Répétition (`--repeat-each=20`, run 39586203494, sur `35a20bf`) : 10 échecs 418 sur 80 exécutions (`:87` 8/20, `:119` 2/20).
- Diagnostics faits, sans cause trouvée :
  - Correctif de contrat `getServerSnapshot` (`35a20bf`, `ETAT_INITIAL` dans `useEtatSynchro`) : correct en soi, sans effet sur le 418 (run 39582802166 : 1 échec ; répétition : 10/80).
  - Comparaison HTML serveur et DOM client (`cd673ee`, retirée en `7e30176`) : ne peut pas localiser le désaccord, car le DOM lu est déjà re-rendu par React. Aucun écart réel non expliqué.
  - Diagnostic en développement (`05f33ba`, `27768cb`, run 39591124178) : 30 chargements de `/qg` avec le React de développement, 0 message d'hydratation, 0 erreur ni avertissement de console, 0 pageerror. Le 418 ne se reproduit pas en développement.
  - Contrôle de la capture (`80b4aa3`, run 39592357410) : la route `/controle-hydratation`, retirée après le contrôle, provoquait un désaccord volontaire ; la capture le reçoit à 3 chargements sur 3. Le zéro sur `/qg` est donc établi : la capture ne le masque pas.
- Expériences du 21/10 (branche temporaire `diag-418`, spec `e2e/diag-418.spec.ts`, retiré de `verif`) :
  - À chaud, contexte réutilisé (20 `goto /qg` par série) : bloqué 0/20, sous service worker 0/20 (run 39657975102, commit `3f67670`). Les deux premiers essais (runs 39656020868 et 39657018625) n'ont rien mesuré : lien d'équipe à usage unique, puis code de connexion déjà inséré.
  - À froid, entrée comme `hors-ligne.spec.ts` (contexte neuf, lien neuf par essai, premier `goto /qg` compté, 30 essais par série) : A bloqué 0/30 ; B sous service worker 1/30 (run 39659082047, commit `d083c2c`). Le 418 de B est arrivé sur un `/qg` que le service worker ne contrôlait pas. Aucun essai de B n'avait `/qg` contrôlé avant le chargement.
  - Sur ce chemin d'entrée, le service worker ne contrôle pas encore le premier `/qg` : l'hypothèse « `/qg` servi sous contrôle du service worker » ne peut pas être testée ici.
  - Conclusion : le service worker n'est pas nécessaire au 418 du premier chargement ; **cause non établie**. Le cas du rechargement (`attendreServiceWorker` dans `hors-ligne.spec.ts`, `page.reload()` après prise de contrôle) reste ouvert : il n'a pas été testé isolément.
  - Enquête arrêtée là (décision de l'Orchestrateur, 21/10) : coût et rendement. Dans le run efb7247, le 418 de `hors-ligne:134` est arrivé au premier chargement et a été toléré (« 418 toléré : 1 »).
  - Fait nouveau (run 40052293089, commit 5a72e8f) : le 418 est arrivé au **second** chargement complet de `/qg` en ligne, après `/notes` et un rechargement de la page. Probablement sous service worker, mais **non vérifié**. Pas de test isolé de ce cas.
- Tolérance (`e2e/hors-ligne.spec.ts`, helper `qgEnLigne`) : le 418 est toléré à un chargement complet de `/qg` en ligne, avant le passage hors ligne (goto ou reload de `/qg`), dans les tests « + puis Note… » (`:103` dans le fichier actuel, `:87` avant 5a72e8f ; ses deux `/qg` en ligne) et « une app jamais visitée » (`:134`, `:119` avant 5a72e8f). Après `setOffline(true)`, ou sur une autre page, un 418 fait toujours échouer le test. Chaque occurrence s'écrit dans le log (« 418 toléré : 1 »), pour voir si elle disparaît ou s'aggrave. Toute autre erreur, ou un 418 à un autre moment, fait échouer le test. Portée : c'est une tolérance de mesure, pas une correction. Une erreur qui arrive après l'affichage des tuiles n'est pas tolérée.
- Piste suivante : build de test avec le React de développement (hors périmètre de la tâche 4.3c, noté dans `docs/plan-developpement.md`).

### Intermittent suivi : `e2e/hors-ligne.spec.ts:87`

- Test : « hors ligne : + puis Note depuis le QG ouvre les notes sans erreur ».
- Échec sur le run 39471174537 (commit 9fbead9) : erreur React #418 (hydratation, HTML). Elle arrive au **premier chargement en ligne de `/qg`**, avant la phase hors ligne : le test collecte les erreurs de page depuis son début, d'où un nom trompeur.
- Référence verte : run 39474476309 (commit 8b7d693), 136 tests passés sur 136.
- Cause non établie. Le HTML serveur de `/qg` et le DOM client ont la même séquence de textes : la différence est ailleurs (attribut, nœud non textuel).
- Suivi : voir la section « Erreur 418 au premier chargement en ligne de `/qg` » ci-dessus (diagnostics, contrôle, tolérance et sa portée).

### Intermittent suivi : `e2e/hors-ligne.spec.ts:119`

- Test : « hors ligne : une app jamais visitée affiche la page de repli, sans écran d'erreur ».
- Échec sur le run 39480825378 (commit bf1e6d3, documentation seule ; code `src` et `e2e` identique au run vert 39474476309) : erreur React #418, relevée au premier chargement en ligne de `/qg`, comme pour `hors-ligne.spec.ts:87`. Même cause présumée, non établie.
- Deuxième apparition du 418 : décision (2) de l'Orchestrateur. Diagnostic (HTML serveur et DOM client de `/qg`) dans un commit séparé, hors des tests (`efa08d6`, corrigé en `311962b`).
- Résultat (run 39495850178, 5 chargements de `/qg` dans des contextes neufs) : aucune erreur de page ni de console, donc 418 non reproduit. Attributs de `<html>` identiques (seule la sérialisation de `style` diffère) ; `<body>` sans attribut. Premier écart de texte : « En ligne » côté serveur, « Synchronisé à l'instant » côté client, libellé de l'indicateur de synchro, donc après hydratation. Limite : seule la première différence était relevée, pas l'état au moment de l'hydratation.
- Cause non établie. Parqué (décision 3 de l'Orchestrateur) : le spec de diagnostic est retiré de la suite ; il reste dans l'historique (`efa08d6`, `311962b`) pour être rejoué.
- Troisième apparition : run 39539354644 (commit 34facd3), même signature. Trace lue : le `pageError` tombe pendant le premier chargement en ligne de `/qg`, après le comptage des tuiles et avant le reload, le passage hors ligne et le clic sur « Budget ». Non bloquant selon la règle de l'Orchestrateur (418 au premier chargement, avant toute action du test).

### Corrigé (a06ff42) : `e2e/liste-john.spec.ts:134`

- Statut : corrigé. Runs complets verts depuis la correction : 39515002395, 39528399664, 39593601284 (`verif`).
- Test : « liste de John : calendrier en vue mois et filtres sur téléphone, pastilles retirables ». Échec sur `locator.click` du lien « Mois » (ligne 147), timeout de 20 s.
- Échec sur le run 39477610690 (commit 364916e, documentation seule ; code identique au run vert 39474476309).
- Lecture de la trace : après le clic sur la tuile Saison depuis le QG, la page affiche le contenu du QG (tuiles, « Le QG »), alors que la barre d'app marque « Calendrier » comme actif. L'URL et la sous-navigation suivent la navigation, le contenu reste celui du QG.
- Cause : deux navigations qui se chevauchent dans le test. Après le clic « retour au QG », le test cliquait la tuile Saison sans attendre l'arrivée sur `/qg` : le clic tombait sur un lien de la page précédente (sous-navigation Saison, encore affichée), pendant que la navigation vers `/qg` n'était pas finie. Le journal réseau le montre : `GET /qg?_rsc=…` émis après le clic, URL encore sur la page épreuve, puis `GET /apps/saison?_rsc=…`. Correction côté test (décision (a) de l'Orchestrateur) : attendre l'URL `/qg` et la tuile, puis cliquer la tuile du QG.
- Émetteur du `GET /qg?_rsc=…` : le routeur Next lui-même (pile interne, aucun appel `router.refresh()` de l'app n'a été déclenché dans les runs instrumentés). Un préchargement de tuile n'est pas en cause.
- Risque résiduel côté app, non corrigé : deux appuis très rapprochés peuvent faire changer l'URL sans que le contenu suive (comportement du routeur Next dans ce cas). Un utilisateur qui appuie vite sur deux liens peut le voir. À suivre, sans correctif tant que l'Orchestrateur ne l'a pas décidé.
- Runs de référence : 39514032165 (rouge, avant la correction, navigations chevauchées), 39510369396 (vert, même chevauchement sans échec : l'ordre des réponses n'est pas maîtrisé par le test).
- Historique : 7 échecs sur 12 runs du 20 et du 21/10 (39480825378, 39487952792, 39488585671, 39492136999, 39495850178, 39506478640, 39514032165). Si le test échoue à nouveau après la correction, la règle est celle de la décision (3) : sur du code identique à un run vert, ça ne bloque pas `dev` ; un échec nouveau, ou sur du code modifié, bloque.

### Intermittent suivi : `e2e/voiture-deco.spec.ts:337`

- Test : « responsable : déplacer une forme avec son logo après l'avoir redimensionnée garde la taille ». Échec sur `expect.poll` de la largeur après un redimensionnement à la poignée (« Aile avant » reste à 61,8 au lieu de plus de 64,8, délai de 15 s).
- Échec sur le run 39552717997 (commit bd79933). Code Voiture identique au run vert 39546225474 (commit 0fc59ee), où le même test passe en 8,9 s.
- Même test déjà fléchi au run 39492136999 (ligne 334 dans ce fichier, même famille de glisser-déposer sur poignée).
- Cause non établie : le glisser-déposer de la poignée ne produit pas toujours le déplacement attendu dans le délai. Pas de trace lue à ce jour pour ce run.
- Règle appliquée (décision (3) de l'Orchestrateur, confirmée le 21/10) : sur du code identique à un run vert, ça ne bloque pas `dev`. Un échec nouveau, ou sur du code modifié, bloque.

## Runs rouges depuis la 4.0b : classement (avant fusion dans main)

Périmètre : les 48 runs de `verifications.yml` depuis `9fbead9` (20/10/2026, vers 18 h), branches `verif` et `dev`. 47 ont exécuté le job e2e (24 verts, 23 rouges). Le run dev `39530793049` (commit `3bf8f36`) est annulé : non compté. Lecture des logs complets, sans relance. « Depuis `3bf8f36` » : runs postérieurs au commit `3bf8f36` (aide d'envoi).

Compte : **11 runs rouges sur 23 contiennent l'erreur React #418** : 8 sur `hors-ligne.spec.ts:87`, 3 sur `hors-ligne.spec.ts:119`. Le 418 n'est donc pas limité à `:87`.

| Run | Branche | Commit | Test(s) en échec | Cause | État |
|---|---|---|---|---|---|
| 39471174537 | verif | 9fbead9 | hors-ligne:87 | 418 au premier chargement de `/qg` | Intermittent suivi (418) |
| 39477610690 | verif | 364916e | liste-john:134 | Navigations qui se chevauchent, clic sur Mois, timeout 20 s | Corrigé : a06ff42 |
| 39480825378 | verif | bf1e6d3 | liste-john:134 ; hors-ligne:119 | liste-john : idem ; hors-ligne:119 : 418 | liste-john corrigé (a06ff42) ; 418 suivi |
| 39487952792 | dev | d4eaf05 | liste-john:134 ; voiture-deco:406, :437 ; hors-ligne:119 | liste-john : idem ; voiture-deco : sélecteur sans `:visible` (copie cachée du streaming) ; 418 | liste-john corrigé (a06ff42) ; voiture-deco corrigé (1d16a76) ; 418 suivi |
| 39488585671 | verif | cd904f5 | liste-john:134 | Idem | Corrigé : a06ff42 |
| 39492136999 | verif | efa08d6 | liste-john:134 ; voiture-deco:334 ; diagnostic-hors-ligne:82 | liste-john : idem ; voiture-deco : copie cachée ; diagnostic : `DOMParser` absent de Node (défaut du test de diagnostic) | liste-john corrigé (a06ff42) ; voiture-deco corrigé (1d16a76) ; diagnostic retiré (a0c40ef) |
| 39495850178 | verif | 311962b | liste-john:134 ; voiture-deco:536 | Idem | liste-john corrigé (a06ff42) ; voiture-deco corrigé (1d16a76) |
| 39499841326 | verif | a0c40ef | voiture-deco:98, :538 | Sélecteurs par rôle, perdus sous le tiroir modal (b5ed26b) | Corrigé : 1d16a76 (`:visible`) |
| 39503223048 | verif | 1d16a76 | hors-ligne:87 | 418 | Intermittent suivi (418) |
| 39506478640 | verif | 977609d | liste-john:134 | Idem | Corrigé : a06ff42 |
| 39514032165 | verif | 02dacb4 | liste-john:134 | Idem, dernier échec avant a06ff42 | Corrigé : a06ff42 |
| 39520820033 | verif | 099c4de | hors-ligne:87 | 418 | Intermittent suivi (418) |
| 39523480135 | dev | 099c4de | hors-ligne:87 | 418 | Intermittent suivi (418) |
| 39523629008 | verif | 2955d39 | hors-ligne:87 ; partenaire-page:198 | 418 ; partenaire-page : POST de révocation coupé par `page.reload` (trace), un lien révoqué répondait 200 | 418 suivi ; partenaire-page corrigé : 7345ef2 |
| 39526025280 | verif | 7345ef2 | voiture:64 | « Enregistrer » puis `goto` 10 ms après : POST coupé (trace) | Corrigé : 3bf8f36 (aide d'envoi) |
| 39531022168 | verif | 566aa84 | hors-ligne:87 | 418 | Intermittent suivi (418) |
| 39539354644 | verif | 34facd3 | hors-ligne:119 | 418 | Intermittent suivi (418) |
| 39546225474 | verif | 0fc59ee | garage-hors-ligne:19 | Pièce absente de la liste « Pièce utilisée » (la pièce de test n'était pas en stock) | Corrigé : 4d024e4 |
| 39548389381 | verif | 4d024e4 | garage-hors-ligne:19 | Ordre jamais arrivé en base après le retour du réseau (fiche personne du responsable absente) | Corrigé : a43e9c8 puis bd79933 |
| 39550585406 | verif | a43e9c8 | garage-hors-ligne:19 | Même symptôme : compte non relié à sa fiche (`core_person.user_id`) | Corrigé : bd79933 |
| 39552717997 | verif | bd79933 | voiture-deco:337 | Glisser la poignée : largeur sous le seuil après 15 s. Trace non lue | Intermittent suivi |
| 39565329067 | verif | c22de9f | hors-ligne:87 | 418 | Intermittent suivi (418) |
| 39571735559 | verif | a8bc84d | hors-ligne:87 | 418 | Intermittent suivi (418) |
| 40052293089 | verif | 5a72e8f | hors-ligne:103 (ex-`:87`, « + puis Note ») | 418 à environ 1676 ms, après `premierQgEnLigne` (ligne 108), pendant le second chargement de `/qg` en ligne (lignes 111-112 à l'époque, non couvert alors). Trace lue | Nouveau moment, non toléré à l'époque ; tolérance étendue à ce chargement ensuite (helper `qgEnLigne`, décision de l'Orchestrateur) ; suivi 418 |

**Depuis `3bf8f36`** : 8 runs rouges (39531022168, 39539354644, 39546225474, 39548389381, 39550585406, 39552717997, 39565329067, 39571735559). Hors 418 et `voiture-deco:337`, il reste `garage-hors-ligne:19` (3 runs, 0fc59ee, 4d024e4, a43e9c8), corrigé par bd79933 : aucun échec de ce test dans les runs suivants (39552717997 à 39579299567, jusqu'au run verif de dbc5df5).

**Non classés** : aucun. `partenaire-page.spec.ts:198` et `voiture.spec.ts:64` sont classés par trace (règle « envoi, puis attendre la réponse », section « Après un envoi »).

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

Le rendu des polices du runner Linux est différent de celui des captures d'avant la 4.0b : toutes les captures viennent désormais du runner, et ce changement de police n'est pas une régression.

### Aide : membres supplémentaires

`ajouterEquipier` (équipage, sans lien de connexion) et `ajouterMembreConnectable` (équipage ou assistance, avec un lien de connexion) ajoutent un membre à la team de test. Ils sont nettoyés avec elle. `compterSuppressions` lit les demandes de suppression en base.

### Pièges de sélection : copie cachée du streaming

- Après le chargement d'une page, React peut laisser une copie cachée d'une liste dans le DOM : le streaming de la frontière Suspense ajoute `<div hidden id="S:0">` avec une seconde copie du contenu. Un sélecteur CSS nu (`section > ul > button`, `locator("button")`) la compte : « strict mode violation … resolved to 2 elements ».
- Règle : pour une liste de l'interface, `:visible` dans le sélecteur CSS (`locator("button:visible", { hasText })`). Ne pas passer par le rôle : pendant qu'un tiroir modal est ouvert, la page reçoit `aria-hidden` et `getByRole` ne voit plus la liste, alors que la vérification doit encore la voir (cas de `voiture-deco.spec.ts` lignes 134 et 559, premier essai par rôle, run a0c40ef).
- Exception volontaire : un test qui vérifie qu'un élément inerte ne réagit pas (`voiture-deco.spec.ts`, « Déplacer ») garde le même sélecteur ; l'inertie ne le masque pas.
- Cas vécus, sans doublon de données (la fiche et le plan avaient le bon nombre d'emplacements) : `e2e/voiture-deco.spec.ts` lignes 406 et 437 (run 39487952792), 334 (run 39492136999), 536 (run 39495850178).
- Le piège `getByText` qui trouve aussi les `<option>` d'un `<select>` est dans `CLAUDE.md` (pièges du lot 2).

### Après un envoi : attendre la réponse

Règle : après un envoi (bouton d'un tiroir ou d'un formulaire, qui déclenche une server action), attendre la réponse avant toute navigation (`goto`, `reload`, clic de lien ou de menu). Le navigateur annule une requête en vol au premier rechargement : l'écriture peut alors ne pas avoir lieu, et le test lit l'ancien état.

- Aide : `envoyer(page, bouton)` dans `e2e/aide/envoi.ts`. Elle attend la réponse POST portant `next-action`, puis la fermeture du tiroir s'il y en a un. Utiliser cette aide pour tout envoi suivi de navigation, sans exception.
- Cas vécus (21/10) : `e2e/partenaire-page.spec.ts:198` (révocation, POST `-1` dans la trace du run 39523629008) et `e2e/voiture.spec.ts:64` (sauvegarde de la fiche, POST `-1` dans le run 39526025280). Les deux échecs venaient de la même course : le test naviguait pendant l'envoi.
- Côté app, le tiroir ne se ferme qu'à la réponse du serveur, donc pas de faux succès. Une sortie de page pendant l'envoi reste un risque (point ouvert, `docs/plan-developpement.md`, lot 4).
- Le runner GitHub a un autre minutage que le poste : ces courses sortent d'un run à l'autre. Les fermer toutes d'un coup plutôt qu'une par une.

## Parcours de John (tâche 4.3d)

`e2e/parcours-john.spec.ts` parcourt la team créée par la CI à l'étape « Team du parcours de John » (`pnpm team:creer --slug parcours-john`, puis `pnpm donnees:koehling --slug parcours-john`), comme la team de dev : entrée par `/connexion`, puis des clics depuis le QG, sans adresse tapée après l'entrée. Il couvre les onze tuiles, Partenaires (le fournisseur), Garage (« Préparer l'atelier », durée des freins, puis un roulage qui met l'atelier au rouge), Garage (Réparer, avec l'état saisi à 80 %, puis le retour au vert), Garage (Remplacer avec prix et fournisseur, puis Remplacer depuis la réserve avec la destination « rebut »), Commandes (une commande reçue), Budget (trois propositions à confirmer : main-d'œuvre, pièce achetée, commande), Voiture (la Déco, avec le modèle choisi), et l'atelier à 360 px. Captures à 1440 px (rouge, remplacement) et à 360 px : `docs/captures/parcours-john-*`, téléchargées depuis l'artefact `captures` puis relues.

**Exception assumée** : la connexion passe par `ajouterCodeConnu` (un code connu, en base), comme `connexion.spec.ts`. Le reste est écrit par les scripts ou par l'interface.

**État de départ mesuré** (lecture seule sur la base dev, transaction `READ ONLY` annulée, script jetable supprimé ensuite, 24/10/2026) : la team d'essai dev a une Saxo dans `core_vehicle`, mais aucune ligne `voiture_vehicle`, aucun organe d'atelier (l'atelier n'est pas préparé), aucune pièce, et la table `garage_part_etat` n'existe pas sur dev (les migrations de la 4.3e ne sont pas encore poussées sur `dev`). Le parcours ne dépend donc pas de l'atelier de dev : il prépare son atelier lui-même, comme John le ferait sur une voiture neuve.

**Règle** : pas de push sur `dev` tant que `parcours-john` n'est pas vert sur le run de la tête de `verif`. Un échec de ce spec bloque `dev`, même si le reste est vert.

**Inventaire des aides qui écrivent en base** (`e2e/aide/`, 4.3d). « Parcours par l'interface » : **oui** = un chemin existe dans l'interface et `parcours-john` ou un autre spec le suit ; **à vérifier** = non vérifié, le chemin n'est pas repéré ; **non** = usage de test seulement. Les lectures (`…EnBase` qui ne font que `SELECT`) ne sont pas listées.

| Aide (fichier) | Ce qu'elle écrit | Parcours par l'interface |
| --- | --- | --- |
| `creerEquipe` (session) | team, 11 apps, responsable, lien | non : script `team:creer`, aucun écran de création de team |
| `supprimerEquipe` (session) | nettoyage de la team | non : test seulement |
| `ajouterCodeConnu` (session) | code de connexion | non : test seulement, le code arrive par mail |
| `ajouterMembreConnectable`, `retirerAdhesion`, `rattacherPersonne` (session) | membre, adhésion, fiche personne | à vérifier : invitations et réglages des membres |
| `ajouterVoitureSaxo`, `ajouterVoitureDeCourse` (session) | véhicule | oui : Voiture, « + » Véhicule (`voiture-deco.spec` crée « Saxo 2 » ainsi) |
| `donnerAccesVoiture`, `donnerAccesSaison`, `definirAccesBudget` (session) | niveau d'accès par app | à vérifier : écran des droits |
| `preparerSaison`, `preverSaisonEnBase`, `preverEpreuveEnBase`, `ajouterEpreuveEnBase`, `passerEpreuveDansLePasseEnBase`, `engagerVehiculeEnBase`, `ajouterResultatValideEnBase`, `ajouterSpecialeEnBase`, `ajouterVehiculeDeReco`, `ajouterPapierEnBase` (session) | saison, épreuves, engagements, résultats, papiers | à vérifier : app Saison |
| `ajouterRecetteBudgetEnBase`, `definirLogoTeamEnBase` (session) | recette Budget, logo de la team | à vérifier |
| `proposerMouvementBudget` (session) | proposition de mouvement venue du Garage (émise par le bus) | oui, indirect : `parcours-john` fait naître les deux propositions par l'intervention terminée et la commande reçue |
| `preparerAtelierSaxo` (garage) | organes, pièces montées, durées | en partie : « Préparer l'atelier » (`parcours-john`) ; les pièces montées (« + Pièce », « Poser ») sont dans `parcours-john` pour une seule pièce, à vérifier pour les autres |
| `monterPieceSansDuree` (garage) | pièce montée sans durée | à vérifier : « + Pièce » puis « Poser », sans durée |
| `fournisseurDeTest` (garage) | contact fournisseur | oui : Partenaires, « + » Partenaire (`parcours-john`) |
| `pieceEnStockDeTest` (garage) | pièce en stock | oui : Garage, « + » Pièce (`parcours-john`) |
| `personneResponsableDeTest` (garage) | fiche personne du responsable | oui : `team:creer` la crée |
| `preparerPageDePartenaire`, `contrepartie`, `renseignerMentionsConvention`, `expirerLien`, `poserLogoPartenaire` (partenaire-page) | page, contreparties, convention, lien, logo | à vérifier : fiche partenaire |
| `emettreActionSaison`, `preparerDonneesCaptures` (session) | action requise Saison (bus), données de captures | non : test seulement |

Rien n'est supprimé à ce stade : l'inventaire vient d'abord. Les aides marquées « à vérifier » sont à reprendre une par une, en remplaçant chacune par un parcours d'interface quand il existe.

## Garage : pneus et casses (tâche 4.4)

- **Unitaires** : `src/apps/garage/pneus.test.ts` (validation d'un train, bornes de l'usure, libellés « Neuf », « Utilisé », « Usé », train d'une autre voiture refusé, message d'achat sans jargon, prix sans fournisseur refusé) ; `src/apps/garage/casses.test.ts` (types de casse, règle « à compléter », calcul des pièces montées à la date de la casse, titre de la réparation).
- **Base** : `pnpm db:verifier-garage`, étendu en 4.4 (joué par la CI, job `complet`) : montage d'un train qui démonte le précédent, course de deux montages, index unique du train monté ; train acheté par commande reçue, un seul `garage.piece_achetee` ; ligne Pneus refusée depuis Commandes et réception sans données de train refusée, sans écriture ; `saison.abandon_declare` : une fiche, cause et spéciale reprises, second traitement sans doublon, engagement introuvable ou supprimé sans fiche ni erreur ; fiche à la main ; complétion et liens organes et pièces ; réparation liée une seule fois ; RLS entre teams sur `garage_incident`, `garage_incident_component` et `garage_incident_part`. Le compte des tables `garage_` reste à seize (`db:verifier-rls`, pas de nouvelle table en 4.4).
- **e2e** : `e2e/garage-pneus.spec.ts` (train ajouté, monté, usure saisie, filtre des trains usés, à 1440 et 360 px) ; `e2e/garage-casses.spec.ts` (abandon validé dans Saison, fiche au Garage, complétée, réparation ouverte, à 1440 et 360 px). Le parcours de John reprend les deux : étape « pneus pluie montés pour une épreuve » et étape « abandon, fiche casse complétée ».
- **Parcours de John, abandon** : le retour au QG se fait par le lien d'enveloppe (`retourAuQg`) avant la tuile Garage. Les tuiles n'existent pas sur la page de l'épreuve : un clic sur `a[href="/apps/garage"]` depuis Saison attend sans fin (run 40067969126, `parcours-john.spec.ts:316`).

## Garage : plan avant épreuve et Saison (tâche 4.5)

- **Unitaires** : `src/apps/garage/plan.test.ts` (estimation après l'épreuve : mode km, épreuves, les deux ; sans km prévus ; durée manquante ; saisie après réparation ; plancher à 0 % ; décompte des zones ; coût masqué hors écriture) ; `src/apps/saison/avant-epreuve.test.ts` (km prévus : longueur × passages, un passage si vide, spéciales sans longueur) ; `src/apps/saison/preparation.test.ts` (quatre points, sans les pièces : une zone rouge ne fait pas baisser l'indice) ; `src/apps/garage/widgets.test.ts` (résumés des widgets).
- **Base** : `pnpm db:verifier-garage`, section 15 : le plan prend la prochaine épreuve engagée, ne compte que l'ordre prévu avant elle (ni l'ordre d'une autre épreuve, ni l'ordre terminé), ne renvoie aucun coût hors écriture, les somme au niveau écriture, et reste fermé à une autre team (lectures partagées de Garage et de Saison). `db:verifier-bus` : une pièce en zone rouge ne pose plus de point « pièces ».
- **e2e** : `e2e/garage-plan.spec.ts` (un seul spec, depuis les tuiles et les menus). L'embrayage de l'atelier de test est à 2 % (zone rouge) : le plan le montre ; Saison affiche « À surveiller, sans effet sur l'indice » et l'indice ne change pas ; la réparation à 80 % depuis le plan lève l'alerte ; l'assistance voit le plan sans coût. Captures à 1440 et 360 px dans `docs/captures/garage-plan-*`.

## Garage : équipements de la team (tâche 4.6)

- **Unitaires** : `src/apps/garage/equipements.test.ts` (21 tests) : échéance du contrôle (dépassé, bientôt, aujourd'hui, plus tard, aucun ; frontière à 29 et 30 jours ; changement d'heure du 25/10), date civile, valeur en euros (virgule, point, espaces, négative refusée), validation de la saisie (nom vide, catégorie inconnue, date absente du calendrier), résumé de l'écran, regroupement par catégorie.
- **Base** : `pnpm db:verifier-garage`, section 16 : création (valeur en centimes, date civile, `rev` à 1), refus sans nom et avec valeur négative, modification (`rev` à 2, champs vides redevenus vides), retrait doux (`rev` à 3), second retrait refusé, liste sans l'équipement retiré, valeur servie au niveau écriture et nulle hors écriture, RLS entre deux teams.
- **e2e** : `e2e/garage-equipements.spec.ts` (un seul spec, depuis le QG, la tuile, le menu et le bouton +). Responsable : ajout d'une remorque au contrôle dépassé de trois jours et d'un compresseur sans contrôle, mots d'échéance, total (2 850,00 €), modification (2 000 €), retrait. Assistance : liste et échéances sans valeur ni bouton d'écriture, avec la raison. Captures à 1440 et 360 px dans `docs/captures/garage-equipements-*`.
- **Menu +** : `src/components/qg/entrees-plus.test.ts` : « Équipement » pour le responsable et l'équipage, hors terrain, jamais pour l'assistance.

## Lot 4 : vérification du parcours complet (tâche 4.7)

- **Unitaires** : `src/components/formulaire/avertissement-sortie.test.ts` (2 tests) : sans envoi en cours, la sortie passe sans message ; pendant un envoi, elle est retenue avec un message.
- **e2e** : `e2e/garage-parcours-complet.spec.ts`, un seul test en neuf étapes, depuis le QG et ses tuiles : préparation de l'atelier, réparation et remplacement avec destination de l'ancienne pièce, commande reçue et proposition Budget confirmée, engagement et paiement, résultat avec usure validée par un autre équipier, réglage d'une durée de vie en zone rouge, plan avant épreuve et ordre à faire avant, réparation puis indice remonté, abandon validé par un troisième équipier puis casse ouverte jusqu'à sa réparation. Captures à 1440 et 360 px aux étapes 1, 6, 7 et 9 (`docs/captures/garage-parcours-*`). Durée : 48,3 s.
- **Base** : après l'usure validée, une ligne de journal par pièce montée (`source` = `resultat_saison`), km +12,5, épreuves +1, `rev` +1, le tout attendu jusqu'à ce que le journal ait exactement une ligne par pièce.
- **Navigation contrôlée** : le clic de menu du Garage (« Casses ») vérifie l'URL d'arrivée ; sans navigation, il est relancé une fois et compté dans le log (`clic sur « Casses » perdu : relancé`). Cause du cas vécu (run 40148965567) non établie côté app ; le test ne la masque pas, il la compte.
- **Compteurs à suivre** : « 418 toléré » (0 au run 40150590450) ; `e2e/voiture-deco.spec.ts:337` (vert au run 40150590450).
- **Runs de la tâche** : 40142463326 (étape 2, Budget : clic pendant le chargement), 40144019675 (étape 5 : la règle ne demande pas d'autre membre au responsable), 40145611004 (étape 8 : fiabilité absente, amortisseurs non critiques), 40147196409 (étape 9 : lien de connexion déjà consommé), 40148965567 (étape 9 : clic « Casses » perdu), 40150590450 (vert, 22dccd5).
- **Hors CI** : le rendu clair et sombre à 1440 et 360 px n'est pas vérifié dans un navigateur sur le poste ; seules les captures CI le montrent.

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
