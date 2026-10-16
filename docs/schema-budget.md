# Budget : schéma et services (tâche 2.5)

Schéma, règles pures et services de Budget, sans écran (les écrans viennent en 2.6, les liaisons avec Saison en 2.7). Spécification : article Odoo 950 (Budget v1.1), catalogue 962, brief `docs/briefs/2.5-budget-schema-services.md`. Modèle : Saison (`docs/schema-saison.md`).

## Tables

Huit tables, préfixe `budget_`, bloc commun (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`), RLS `cloisonnement_team` forcé. Migration `20261016221700_budget_schema`.

| Table | Rôle |
|---|---|
| `budget_category` | Catégorie de dépense ou de recette. Unique `(team_id, sens, nom)`. Parent facultatif. |
| `budget_payer` | Qui paie ou encaisse : un membre (`person_id`), la caisse de la team, ou un compte d'association. Unique `(team_id, person_id)`. |
| `budget_expense` | Dépense : montant, catégorie, payeur, rattachement facultatif (épreuve, saison, engagement, voiture, fournisseur, justificatif), confirmation, remboursement. |
| `budget_income` | Recette : prévue puis encaissée sur un compte, ou en nature (description et valeur estimée). |
| `budget_forecast` | Prévisionnel par catégorie et par saison, ou par épreuve. Unique `(season_id, category_id, event_id)`, plus un index partiel pour `event_id` NULL. |
| `budget_reimbursement` | Remboursement d'un membre, payé depuis la caisse ou un compte d'association. |
| `budget_reimbursement_line` | Ligne d'un remboursement : une dépense et un montant. Unique `(reimbursement_id, expense_id)`. |
| `budget_suggestion` | Mouvement proposé par une autre app, en attente de confirmation dans la boîte d'actions. |

Conventions (`docs/conventions-schema.md`) :

- Montants en `Int`, en centimes, avec `devise` (`EUR` par défaut). CHECK `montant >= 0` ajouté à la main.
- Dates calendaires en `@db.Date` (`date`, `encaissee_le`).
- Contraintes ajoutées à la main dans la migration, que Prisma ne décrit pas : `budget_payer_membre_personne_check` (un payeur est un membre si et seulement s'il a une personne), CHECK des montants, index partiel du prévisionnel sans épreuve.
- `migrate diff` après application : migration vide.
- Relations inverses ajoutées aux modèles du socle (`CoreTeam`, `CorePerson`, `CoreSeason`, `CoreEvent`, `CoreEventEntry`, `CoreVehicle`, `CoreContact`, `CoreFile`).

## Initialisation

`pnpm db:initialiser-budget` (`scripts/initialiser-budget.ts`) : pour chaque team, les catégories par défaut (`src/apps/budget/categories-defaut.ts`), la caisse de la team, un payeur par membre actif ayant une personne. Idempotent. À lancer après `pnpm db:deploy`, sur chaque base, car les teams existantes n'ont pas encore de catégories.

Un nouveau membre n'est pas abonné par événement. Son payeur est créé à la volée, de façon idempotente, la première fois qu'il saisit une dépense « payé par moi » (`payeurDuMembreDans`).

## Règles pures (`src/apps/budget/regles.ts`, testées dans `regles.test.ts`)

1. **À rembourser** : vrai si le payeur est un membre.
2. **Statut de remboursement** d'une dépense : `non_concerne`, `a_rembourser`, `partiel`, `rembourse`, à partir de ses lignes. Une ligne ne dépasse jamais le reste dû (`verifierLigne`, message en français).
3. **Solde par membre** : dépenses confirmées à rembourser, moins ses remboursements. Un trop-perçu n'est jamais négatif : il est renvoyé à part (`trop`) pour être signalé.
4. **Coûts** : par épreuve, moyen (null sans épreuve), au km chronométré (null sans km). Les km viennent de Saison (résultats validés) : ils sont passés en paramètre, la lecture arrive en 2.7.
5. **Écart au prévisionnel** : vert jusqu'à 90 %, orange de 90 à 100 %, rouge au-delà ; sans prévu, rouge dès qu'il y a une dépense.
6. **Confirmation** : une dépense saisie est confirmée d'office ; une dépense proposée l'est quand un humain la valide.
7. **Dépassement** : vrai seulement au franchissement du prévu.
8. **Visibilité** : sans écriture (lecture, contribution), seulement ses propres dépenses ; à partir de l'écriture, tout.

## Services (`src/apps/budget/services-serveur.ts`)

Chaque fonction publique passe par `exigerAcces("budget", niveau)`. Les variantes `…Dans(ctx, …)` font le travail sans garde (scripts, bus).

| Fonction | Niveau | Effet |
|---|---|---|
| `creerDepense` | contribution | Dépense confirmée, date du jour et épreuve en cours par défaut. Sans écriture, seul son propre paiement passe. |
| `creerRecette` | écriture | Recette prévue (ou en nature : description et valeur obligatoires). |
| `encaisserRecette` | écriture | Recette encaissée sur un compte. |
| `rembourser` | gestion | Remboursement à un membre depuis la caisse ou un compte d'association. Total des lignes égal au montant. Transaction. |
| `definirPrevisionnel` | gestion | Crée ou met à jour un prévisionnel. |
| `confirmerSuggestion`, `ignorerSuggestion` | écriture | Décision sur une suggestion (même règle que la boîte). |

Usage interne : `proposerMouvementDans` (crée la suggestion et émet `budget.action_requise`) et `payeurDuMembreDans`.

Décision de la boîte d'actions : `core.action_decidee` est reçu par Budget (`enregistrerGestionnaire`, à l'import du module). Une décision refusée par la règle remet l'action en attente, avec son motif (même règle que Saison).

**Lectures** (`lectures-serveur.ts`) : `lireDepenses` (filtrées par niveau côté serveur), `lireSoldeMoi`.

## Événements

Tous dans le catalogue (`src/core/evenements/catalogue.ts`), aucun nom hors catalogue :

- `budget.depense_creee` (saison), `budget.depense_confirmee` (dashboard) : à chaque dépense confirmée.
- `budget.solde_modifie` (core) : quand le payeur est un membre (dépense) et à chaque remboursement.
- `budget.recette_encaissee` (partenaires) : à l'encaissement.
- `budget.remboursement_effectue` (core).
- `budget.depassement_previsionnel` (core) : une fois au franchissement, par catégorie, saison et franchissement.
- `budget.action_requise` (motif `budget.action_requise`) : `type: "mouvement_a_confirmer"`, clé `budget_suggestion:<id>`, destinataires responsable et équipage, boutons Confirmer et Ignorer, priorité 5.

## Correctif du socle : boucle de traitement des livraisons

`traiterEnAttente` (`src/core/evenements/traitement-serveur.ts`) relançait les livraisons en attente à chaque émission, y compris celle qui était en cours de traitement. Un gestionnaire qui émettait à son tour (une décision de la boîte qui crée une dépense) déclenchait donc une boucle infinie, et le processus manquait de mémoire.

Correction : une livraison en cours est notée dans un ensemble du processus et n'est pas reprise ; chaque livraison est relue avant traitement, car un traitement imbriqué a pu la traiter entre-temps. Vérifié par `db:verifier-bus` (section 13, confirmation d'une suggestion).

## Contribution

Sans écriture, une dépense n'est saisie qu'au nom de son payeur (celui qui la paie soi-même). Les lectures ne renvoient que les dépenses dont le payeur est sa personne. Le filtrage est dans le serveur, pas dans le composant.

## Vérifications

- `pnpm test` : règles pures, schéma (huit tables, bloc commun, montants en centimes, dates calendaires), conventions du schéma.
- `pnpm db:verifier-rls` : huit tables `budget_` avec RLS forcé, politique et droits du rôle applicatif ; une catégorie et une dépense de la team B invisibles ou refusées sous le contexte A.
- `pnpm db:verifier-bus` (section 13) : initialisation idempotente (15 dépenses, 7 recettes, une caisse, un payeur membre) ; dépense confirmée d'office, à rembourser, rattachée à la saison ; événements émis une fois ; dépassement une seule fois ; niveau contribution (caisse refusée, sa propre dépense passe) ; suggestion confirmée par la boîte, dépense créée avec son origine ; décision refusée remise en attente avec son motif ; remboursement partiel et trop refusé.

## Non fait

- Aucun écran (2.6) : les composants n'appellent pas encore ces services.
- Pas de liaison avec Saison (2.7) : les coûts au km reçoivent les km en paramètre.
- Justificatifs (`justificatif_file_id`) : colonne prête, pas de fichier avant le lot 5.
- PDF Budget : lot 3.
- Le gestionnaire de décision est enregistré à l'import de `services-serveur.ts`. Aucune app ne propose encore de suggestion : il faudra que les écrans de 2.6 importent ce module, ou un fichier d'enregistrement, avant la liaison de 2.7.
- Le contrôle de dépassement ne tient compte que du prévisionnel de saison (sans épreuve). Le prévisionnel par épreuve est enregistré, pas encore comparé.
- L'équipe de test laissée par un arrêt brutal du vérifieur (mémoire épuisée, avant le correctif) a été supprimée de la base locale. Le vérifieur nettoie désormais les tables Budget dans son `finally`.
