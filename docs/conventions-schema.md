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
- `CoreUser` et `CoreApp` ne portent pas ces colonnes (le test les exclut).

## Montants et dates

- Montants en `Int`, en centimes. Un montant est toujours accompagné d'un champ devise : `devise String @default("EUR")`.
- Dates en `DateTime @db.Timestamptz(3)`. Pas de `Date` ni de `timestamp` sans fuseau.

## Index

- `@@index([teamId])` sur toute table qui porte `team_id`.
- `@@index([teamId, deletedAt])` sur les tables listées dans le cahier des charges, pour les requêtes « lignes actives d'une team ».

## Ce que le schéma ne contrôle pas

- Les contraintes qui dépassent Prisma (format hexadécimal des couleurs, cohérence entre tables) sont à porter par l'application ou par une migration SQL écrite à la main.
