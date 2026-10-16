# Tests

Trois niveaux : unitaires, vérifications en base, bout en bout. Chacun se lance séparément.

## Unitaires (Vitest)

- Commande : `pnpm test` (`vitest run`). Fichiers `src/**/*.test.ts`, environnement node, aucune base.
- Couvre les fonctions pures : jetons et hachage, contraste des couleurs, niveaux de droits, dépendances des apps, règle du dernier responsable, libellés, catalogue des événements, grille du QG.
- Vitest ne lit pas `e2e/` (le motif `include` ne retient que `src/`).

## Vérifications en base

Scripts tsx qui se connectent à la base locale. Ils créent des données de test et les suppriment dans un `finally`.

- `pnpm db:verifier-rls` : cloisonnement par team (lecture, écriture, insertion inter-teams refusées), et RLS activé sur toute table publique qui porte `team_id`.
- `pnpm db:verifier-bus` : bus d'événements, livraisons, gestionnaires du socle.

Pré-requis : `pnpm db:up`, puis `pnpm db:deploy` si la base est neuve.

## Bout en bout (Playwright)

- Commande : `pnpm test:e2e` (`playwright test`). Premier passage sur un poste : `pnpm exec playwright install chromium`.
- Configuration : `playwright.config.ts`. Un seul projet Chromium, un seul worker. Le serveur de test est lancé par Playwright : `pnpm dev --port 3100` avec `NEXT_DIST_DIR=.next-e2e` et `SMTP_HOST` vide, donc les mails s'affichent dans la console. `reuseExistingServer: false` : le serveur de développement du port 3000 n'est jamais utilisé ni arrêté.
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
| `e2e/captures.spec.ts` | captures pleine page dans `docs/captures/` |

Pour le scénario e, le bouton « Désactiver » de Voiture est désactivé par l'interface quand Garage la requiert. Le test vérifie ce blocage et le message, sans tenter le clic.

### Captures

`docs/captures/` : `qg-1440x900.png`, `qg-360x740.png`, `identite-1440x900.png`. Pour une capture pleine page, la barre basse et les éléments fixes sont posés en absolu au bas du document, et l'indicateur de développement de Next est masqué. Seul le rendu de la capture change.

## Enchaînement recommandé

```
pnpm typecheck
pnpm test
pnpm db:verifier-rls
pnpm db:verifier-bus
pnpm test:e2e
```
