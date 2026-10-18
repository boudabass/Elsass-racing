# Voiture : schéma, gabarits et services (tâche 3.2)

Schéma, gabarits, règles pures et services de Voiture, sans écran (les écrans viennent en 3.3, le plan de déco en 3.4). Spécification : article Odoo 952 (Voiture v1.3), découpage `docs/plan-developpement.md` section 5 ter, brief `docs/briefs/3.2-voiture-schema-services.md`. Modèle : Budget (`docs/schema-budget.md`).

## Décisions d'architecture

- **Gabarits dans le code, pas en base.** Un gabarit est un catalogue de la plateforme, sans team, comme le catalogue des apps. Il vit dans `src/apps/voiture/gabarits/`, un fichier par gabarit. `voiture_vehicle.gabarit_cle` le désigne par sa clé. La table `voiture_template` de la spécification n'est pas créée.
- **Un seul gabarit au lot 3 : la Saxo** (décision de John du 18/10). Clé `citadine_3p_saxo`, nom « Citadine 3 portes (Saxo) ».
- **Vues de la Saxo** : le plan ne montre que le profil droit. Le gabarit déclare la vue `droite`, et la vue `gauche` qui en est le miroir (`vuesDessinees`, `miroirDe`). Les vues `avant`, `arriere` et `dessus` n'existent pas encore. Les emplacements qui s'y trouveraient sont en vue `hors_plan` : ils ont un nom, mais pas de forme.
- **Pas de clé étrangère vers une autre app.** `voiture_slot_assignment` garde `partenaire_id` (uuid, sans relation) et `partenaire_nom`, une copie du nom. Partenaires n'existe pas encore.
- **Historique et kilomètres calculés, pas stockés.** Pas d'écoute de `saison.epreuve_terminee` : l'historique se lit à la demande.

## Tables

Sept tables, préfixe `voiture_`, bloc commun (`team_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `rev`), RLS `cloisonnement_team` forcé. Migration `20261018123759_voiture_schema`, purement additive : aucune table existante n'est modifiée (seules des relations inverses sont ajoutées côté Prisma sur `core_team`, `core_vehicle`, `core_event`, `core_event_entry` et `core_file`).

| Table | Rôle |
|---|---|
| `voiture_vehicle` | Fiche technique d'un `core_vehicle` (1 pour 1, `vehicle_id` unique). Gabarit, marque, modèle, puissance, immatriculation, groupe, classe, discipline, date d'achat. Les photos passent par `core_attachment` (rôle `photo`). |
| `voiture_paper` | Papier du véhicule. `type` (enum), `libelle` obligatoire si `autre`, échéance facultative, document rattaché par `core_file`. Pas de statut stocké : il se calcule. |
| `voiture_slot` | Emplacement de logo. `vue`, `nom`, `ordre`, `forme` (JSON, coordonnées du gabarit), dimensions facultatives, `statut`, `symetrique`. |
| `voiture_slot_assignment` | Occupation d'un emplacement : partenaire (uuid et nom), logo, période, statut (`reserve`, `pose`, `retire`), photo de pose. |
| `voiture_setup` | Fiche de réglage : épreuve et engagement facultatifs, date, conditions, revêtement, `valeurs` (JSON), remarques, note 1 à 5. |
| `voiture_setup_template` | Modèle de réglage, éventuellement créé depuis une fiche (`cree_depuis_setup_id`). |
| `voiture_team_pref` | Préférences de la team : `champs_reglage_masques` (tableau de texte). Une ligne par team. |

Les dates sans heure (`delivre_le`, `valable_jusqu_au`, `du`, `au`, `pose_le`, `date`) sont en `@db.Date`, selon `docs/conventions-schema.md`. `achete_le` est en `Timestamptz`, comme la spécification le demande.

## Contraintes écrites à la main (migration)

- `voiture_setup.note` entre 1 et 5 (CHECK, `NULL` autorisé).
- `voiture_paper` : `libelle` non vide quand `type = 'autre'`.
- `voiture_slot_assignment` : un seul enregistrement actif par emplacement, par index unique partiel `WHERE statut <> 'retire' AND deleted_at IS NULL`.

## Gabarits (`src/apps/voiture/gabarits/`)

- `types.ts` : `Gabarit`, `ElementDessin` (`path`, `circle`, `line`, avec un rôle de couleur : `caisse`, `vitre`, `roue`, `jante`, `detail`, `sol`), `EmplacementType`, `FormeEmplacement`, `VueGabarit`.
- `saxo.ts` : le gabarit de la Saxo, transcrit du plan du dossier Koehling (`travail/saxo_plan_emplacements.svg`, hors du dépôt). Les métadonnées, les pastilles, les zones pointillées et la légende ne sont pas reprises. Les couleurs deviennent des rôles : la 3.4 les associera au thème.
- `index.ts` : `GABARITS` et `gabarit(cle)`.
- `gabarits.test.ts` : clés uniques, formes présentes pour les vues dessinées, aucune forme hors plan, ordres de la légende.

## Règles pures

Voir la section « Règles » ci-dessous, complétée à la suite de l'étape 4 du brief.

## Vérifications

- `src/core/schema-conventions.test.ts` : les sept tables respectent le bloc commun et `@@index([teamId])`.
- Dérive : `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` renvoie une migration vide.
- Les vérifications de RLS (`db:verifier-rls`) et de bus (`db:verifier-bus`) sont étendues à ces tables (voir la fin de ce document).
