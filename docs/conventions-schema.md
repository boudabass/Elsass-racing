# Conventions du schéma Prisma

Ces règles s'appliquent à tout modèle de `prisma/schema.prisma`. Elles sont vérifiées par `src/core/schema-conventions.test.ts` (`pnpm test`).

## Noms

- **Tables** en snake_case, via `@@map`. Exemple : `model CoreTeam` ↔ `@@map("core_team")`.
- **Colonnes** en snake_case, via `@map`. Les champs Prisma sont en camelCase : `createdAt @map("created_at")`. Un champ déjà en snake_case (`nom`, `slug`) n'a pas besoin de `@map`.
- **Modèles** en PascalCase, préfixés par le socle (`Core…`) ou par l'application.
- **Enums** : nom en PascalCase préfixé comme leur modèle (`CoreTeamStatut`), `@@map` en snake_case, valeurs en minuscules.

## Identifiants

- `id String @id @db.Uuid`, généré côté client par `newId()` (`src/core/ids.ts`, UUID v7).
- **Jamais** de `@default(uuid())` ni `@default(cuid())` : le test les refuse.

## Colonnes communes

Chaque modèle porte le bloc suivant, copié tel quel. Prisma ne permet pas de le factoriser.

```prisma
  teamId    String    @map("team_id") @db.Uuid
  createdAt DateTime  @map("created_at") @db.Timestamptz(3) @default(now())
  updatedAt DateTime  @map("updated_at") @db.Timestamptz(3) @updatedAt
  createdBy String?   @map("created_by") @db.Uuid
  updatedBy String?   @map("updated_by") @db.Uuid
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(3)
  rev       Int       @default(1)
```

Exceptions :

- `teamId` est **absent** de `CoreTeam`, qui est la team elle-même.
- `teamId` est **absent** aussi de `CoreUser`, `CoreAuthToken` et `CoreDevice` : ils appartiennent à un compte, pas à une team. Ils portent le bloc commun sans `team_id`.
- `CoreApp` et `CoreRoleDefault` n'ont **aucun** bloc commun : ce sont des référentiels globaux. `CoreApp` a une clé texte (`cle`), `CoreRoleDefault` une clé composite `(role, app_cle)`.

Ces listes sont dans `src/core/schema-conventions.ts` (`MODELES_SANS_BLOC`, `MODELES_SANS_TEAM`).

## Montants et dates

- Montants en `Int`, en centimes. Un montant est toujours accompagné d'un champ devise : `devise String @default("EUR")`.
- Dates en `DateTime @db.Timestamptz(3)`. Pas de `Date` ni de `timestamp` sans fuseau.

## Index

- `@@index([teamId])` sur toute table qui porte `team_id`.
- `@@index([teamId, deletedAt])` sur les tables listées dans le cahier des charges, pour les requêtes « lignes actives d'une team ».

## Ce que le schéma ne contrôle pas

- Les contraintes qui dépassent Prisma (format hexadécimal des couleurs, cohérence entre tables) sont à porter par l'application ou par une migration SQL écrite à la main.

## Unique et valeurs NULL

PostgreSQL considère deux `NULL` comme distincts dans une contrainte `UNIQUE`. Conséquence : `CoreTag` avec `@@unique([teamId, nom, portee])` accepte deux étiquettes de même nom dont `portee` est nulle (« toutes les apps »). Vérifié en base le 16/10/2026. C'est le comportement retenu : un doublon de ce type reste possible et doit être contrôlé par l'application si la règle métier l'interdit.

## Relations nommées

Quand un modèle a deux relations vers le même modèle, chaque relation porte un nom, des deux côtés :

- `CoreEventEntry` → `CorePerson` deux fois : `pilote` (`"EntryPilote"`) et `copilote` (`"EntryCopilote"`). `CorePerson` expose `entriesPilote` et `entriesCopilote` avec les mêmes noms.
- `CoreInvitation` → `CoreUser` (`"InvitationEnvoyeePar"`), côté `CoreUser` : `invitationsEnvoyees`.

Les relations uniques vers un modèle n'ont pas besoin de nom.

## Dates de calendrier

Les dates qui n'ont pas d'heure (`dateNaissance`, `dateDebut`, `dateFin` de `CoreSeason` et `CoreEvent`) sont en `@db.Date`, et non en `Timestamptz`. C'est le choix du cahier des charges : une date de naissance ou de course n'a pas de fuseau.

## Le trio app / ficheType / ficheId

Les services transversaux (pièces jointes, activité, notes, tâches, alertes, actions, recherche) doivent désigner une fiche de n'importe quelle app. Le trio `app` (clé d'app), `ficheType` (type de fiche, texte) et `ficheId` (uuid de la fiche) le fait sans clé étrangère : la fiche peut vivre dans une table d'une autre app.

- Ces trois colonnes sont indexées ensemble avec `team_id` : `@@index([teamId, app, ficheType, ficheId])`.
- `core_task`, `core_alert` et `core_action` les portent en optionnel : une tâche ou une alerte peut ne pas être liée à une fiche.
- Conséquence : rien en base ne garantit que la fiche désignée existe. C'est à l'application de le vérifier, et à la suppression d'une fiche de nettoyer ce qui la désigne.

## Colonne générée hors Prisma

`core_search_index.vecteur` est une colonne `tsvector GENERATED ALWAYS AS (...) STORED`, avec un index GIN. Prisma ne sait pas exprimer ces deux éléments : la colonne est déclarée `Unsupported("tsvector")?` dans le schéma, et la migration `core_services` les crée à la main.

**Attention** : `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` propose de supprimer l'index GIN (il n'est pas dans le schéma) et un `DROP DEFAULT` sur `vecteur`. Ces écarts sont connus et attendus. Conséquence pratique : **ne jamais lancer `pnpm db:migrate` sans `--create-only` et relire le SQL généré**, sans quoi Prisma créerait une migration qui supprime l'index. `pnpm db:deploy` ne pose pas ce problème, car il ne compare rien.

Vérifié le 16/10/2026 : `prisma migrate status` indique « Database schema is up to date ».
