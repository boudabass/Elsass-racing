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

Automatique, pas d'étape manuelle : au premier accès à Budget d'une team (`accesBudget`), et avant qu'une autre app propose un mouvement (`proposerMouvementDans`), `initialiserSiBesoin` crée les catégories par défaut (`src/apps/budget/categories-defaut.ts`), la caisse de la team et un payeur par membre actif ayant une personne. Idempotent : sans caisse, rien n'est fait deux fois. Une seule caisse de team : index unique partiel `budget_caisse_unique` (migration `budget_caisse_unique`, qui fusionne d'abord les doublons en douceur). La création tolère la course entre le layout et la page (erreur P2002 attrapée, puis relecture) ; test `db:verifier-bus`. Le script `pnpm db:initialiser-budget` (`scripts/initialiser-budget.ts`) reste pour les vérifications ; l'app ne dépend pas de lui.

Un nouveau membre n'est pas abonné par événement. Son payeur est créé à la volée, de façon idempotente, la première fois qu'il saisit une dépense « payé par moi » (`payeurDuMembreDans`).

## Règles pures (`src/apps/budget/regles.ts`, testées dans `regles.test.ts`)

1. **À rembourser** : vrai si le payeur est un membre.
2. **Statut de remboursement** d'une dépense : `non_concerne`, `a_rembourser`, `partiel`, `rembourse`, à partir de ses lignes. Une ligne ne dépasse jamais le reste dû (`verifierLigne`, message en français).
3. **Solde par membre** : dépenses confirmées à rembourser, moins ses remboursements. Un trop-perçu n'est jamais négatif : il est renvoyé à part (`trop`) pour être signalé.
4. **Coûts** : par épreuve, moyen (null sans épreuve), au km chronométré (null sans km). Les km viennent de Saison (résultats validés) : ils sont passés en paramètre, la lecture arrive en 2.7.
5. **Écart au prévisionnel** : vert jusqu'à 90 %, orange de 90 à 100 %, rouge au-delà ; sans prévu, rouge dès qu'il y a une dépense.
6. **Confirmation** : une dépense saisie est confirmée d'office ; une dépense proposée l'est quand un humain la valide.
7. **Dépassement** : vrai seulement au franchissement du prévu.
8. **Visibilité** : la lecture voit tous les mouvements, sans rien écrire. La contribution ne voit que ses propres dépenses et son solde ; l'écriture et la gestion voient tout.

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

## Écrans (tâche 2.6)

Routes sous `src/app/(app)/apps/budget/`, gardées par `accesEcran` (`src/apps/budget/ecran.ts`) : activation de l'app, puis niveau requis.

| Route | Niveau | Contenu |
|---|---|---|
| `/apps/budget` | contribution | Mouvements, filtres dans l'URL (saison, épreuve, catégorie, membre), totaux, fiche (`m`) à droite sur PC et pleine page sur téléphone. Découverte à la première ouverture. |
| `/apps/budget/nouvelle` | contribution | Dépense en trois champs (montant, catégorie, payé par, « Moi » en premier) ; date et épreuve en cours sous « Plus de détails ». Écrite dans la base locale : hors ligne. |
| `/apps/budget/recette` | écriture | Recette prévue ou encaissée ; en nature (description et valeur estimée). |
| `/apps/budget/a-confirmer` | écriture | Suggestions des autres apps : Confirmer (payeur et catégorie modifiables) ou Ignorer. |
| `/apps/budget/epreuves` | lecture | Coût réel par épreuve, détail par catégorie, moyenne d'un rallye. |
| `/apps/budget/membres` | lecture | Avancé, remboursé, solde par membre ; remboursement (gestion) avec les dépenses couvertes cochées. La contribution ne voit que sa ligne. |
| `/apps/budget/previsionnel` | écriture (voir), gestion (modifier) | Prévu, réel, écart et couleur par catégorie de dépense, pour la saison. |
| `/apps/budget/export` | contribution | CSV des mouvements filtrés (point-virgule, UTF-8 avec BOM). |

Le montant se saisit en euros (`src/apps/budget/saisie.ts`) ; un mouvement au-delà de 1 000 000 € est refusé avec son message. Le bouton + du QG ouvre « Nouvelle dépense » pour tous ceux qui ont la contribution, y compris en terrain (`src/components/qg/entrees-plus.ts`).

Hors ligne : `budget_expense` est en contribution propre (`src/apps/budget/synchro-serveur.ts`). Une dépense saisie hors ligne part à la synchro ; ses événements sont émis à ce moment-là (`apresApplication`). Catégories et payeurs se lisent hors ligne. Une dépense ne se modifie ni ne se supprime depuis l'appareil.

Payeur d'un mouvement proposé : la personne désignée par l'événement (`payeurPersonId`, colonne `budget_suggestion.payer_id`, migration `budget_suggestion_payeur`) ; à défaut, la caisse. L'humain peut le changer en confirmant.

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

## Liaisons avec Saison (tâche 2.7)

Règle : une app propose, elle n'écrit jamais chez l'autre. Budget n'écrit aucune table `saison_`, Saison n'écrit aucune table `budget_`. Tout passe par les événements du catalogue et `core.action_decidee`.

- **Engagement payé vers dépense proposée** (`src/apps/budget/liaisons-serveur.ts`) : sur `saison.engagement_paye`, une dépense d'engagement est proposée (catégorie de clé `engagement`, montant `montant_paye`, payeur = `payeurPersonId` ou la caisse). Une seule proposition en attente par engagement : un second paiement la met à jour (même clé d'action). Rien si une dépense d'engagement est déjà confirmée pour cet engagement. À la confirmation, la dépense porte `origine` proposee et `origine_ref` `saison:<entryId>`.
- **Dépense d'engagement vers « marquer payé »** (`src/apps/saison/services-serveur.ts`) : sur `budget.depense_creee`, si la dépense est de catégorie `engagement`, rattachée à un engagement non payé, et non issue de Saison (`origine_ref` ne commence pas par `saison:`), Saison demande « Marquer l'engagement comme payé ? » (clé `marquer_paye:<entryId>`). La décision lit la dépense par `lireDepenseEngagementDans` (fonction de Budget) et appelle `enregistrerPaiementDans`. Mode : chèque, virement, en ligne ou espèces (valeur `especes` ajoutée à `saison_paiement_mode`, migration `saison_paiement_especes`). Sans moyen : virement.
- **Pas de boucle** : une proposition venant de Saison ne déclenche pas la demande « marquer payé » ; un paiement d'engagement dont une dépense est déjà confirmée ne propose rien. Vérifié dans les deux sens par `db:verifier-bus` (section 14).

## Modifier et supprimer (tâche 2.7, section 0)

- Une dépense se modifie et se supprime en ligne (`modifierDepense`, `supprimerDepense`) et depuis l'appareil (registre de synchro). Même règle : `src/apps/budget/depenses-tx.ts`.
- Écriture : tout mouvement. Contribution : seulement les dépenses dont le payeur est sa personne.
- Une modification ne fait pas descendre le montant sous ce qui a déjà été remboursé, et ne change pas le payeur d'une dépense remboursée. Une dépense remboursée ne se supprime pas. La suppression est douce (`deleted_at`), après case de confirmation.
- Les recettes se modifient et se suppriment en écriture (`modifierRecette`, `supprimerRecette`).
- Page : `/apps/budget/mouvement/[id]`.

## Lectures pour Saison et le QG

- `coutDeLEpreuve(eventId)` : coût réel de l'épreuve, ou rien (jamais un zéro trompeur).
- `lireSoldeBarreHaute()` : « Mon solde » en contribution, sinon le solde de la saison en cours (recettes encaissées moins dépenses confirmées). Affiché dans la barre haute.
- `lireDepensesEpreuve(eventId)` : onglet Dépenses de la fiche épreuve (composant `PanneauDepensesEpreuve`).
- `lireKmChronometresValides(saisonId)` (Saison) : km des résultats validés, pour le coût du km (page Par épreuve).
- Widgets (`src/apps/budget/widgets-serveur.ts`) : saison contre prévisionnel, mon solde, mouvements à confirmer. Pas d'affichage avant le lot 6.

## Écrans ajoutés

- Filtres sur téléphone : un bouton « Filtres » ouvre un tiroir du bas (même composant que le menu +). Les filtres actifs s'affichent en pastilles retirables.
- Par épreuve : prévu de l'épreuve à côté du réel, avec l'écart en couleur ; coût moyen d'un rallye ; coût du km chronométré.
- Nouvelle dépense : engagement concerné, et épreuve préremplie depuis la fiche épreuve.

## Non fait ou à trancher

- Modification et suppression hors ligne depuis l'écran : la synchro les accepte (registre), l'écran reste en ligne. Limite connue, acceptée à la revue du lot 2.
- Le solde sur téléphone est une ligne compacte sous la barre haute (menu de Budget non retenu) ; dans la barre, il reste à partir de md.
- Le prévisionnel par épreuve est affiché dans Par épreuve et dans l'onglet Dépenses de la fiche épreuve, pas dans l'écran Prévisionnel (par saison). Limite connue, acceptée.
- Prévu de l'épreuve : invisible à la contribution. Filtré côté serveur (`lireDepensesEpreuve`, règle `voitTout` : niveau lecture, puis à partir de l'écriture), testé en e2e (`budget-saison.spec.ts`).
- Synchro de `budget_expense` au niveau contribution : l'appareil suit la personne qui paie (comme en ligne), et une écriture n'est permise que sur les dépenses qu'elle paie.
- Justificatifs (`justificatif_file_id`) : lot 5. PDF de bilan : lot 3.

## Action « mouvement à confirmer » et solde en clair (tâche 2.9)

- Une suggestion traitée sur la page À confirmer (confirmée ou ignorée) lève son action `budget_suggestion:<id>` dans la boîte, par `budget.action_levee`. Une décision de la boîte sur une suggestion déjà traitée ne rouvre plus l'action : elle la lève. `rouvrirAction` ne sert qu'aux refus de règle réels.
- Solde d'un membre écrit en clair (`phraseSoldeMoi`, `phraseSoldeMembre` dans `libelles.ts`) : « La team te doit … », « Tu dois … à la team », « Rien à régler ».
- Engagement concerné : préremplissage par la catégorie « Engagement » (clé `engagement`) et l'épreuve choisies.
