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

## Plein texte : colonne ordinaire et trigger

`core_search_index.vecteur` est une colonne `tsvector` ordinaire, non générée. Son contenu est calculé par la fonction `core_search_index_maj_vecteur()` et le trigger `core_search_index_vecteur_trg`, à chaque insertion et à chaque modification de `titre` ou de `texte`. L'index GIN `core_search_index_vecteur_idx` porte sur cette colonne.

Prisma déclare la colonne `Unsupported("tsvector")?` et l'index avec `@@index([vecteur], type: Gin)` : le schéma décrit donc bien la base, et `prisma migrate diff` ne propose rien. La fonction et le trigger ne sont pas décrits par Prisma : ils vivent dans la migration `core_search_trigger`, écrite à la main.

Pourquoi pas une colonne générée : une colonne `GENERATED ALWAYS AS (...) STORED` est invisible pour Prisma sans rien dire, et chaque `migrate diff` proposait alors de la modifier. Le trigger évite cet écart.

Vérifié le 16/10/2026 : `prisma migrate status` indique « Database schema is up to date », et `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` renvoie une migration vide.

## Flux des migrations

Toute migration se relit avant application. `pnpm db:migrate` ne l'applique pas : il ne fait que la créer.

1. **Créer** : `pnpm db:migrate --name nom_de_la_migration` (`prisma migrate dev --create-only`). Prisma écrit le SQL, sans l'appliquer.
2. **Relire** : ouvrir `prisma/migrations/<horodatage>_nom/migration.sql` et vérifier chaque instruction.
3. **Compléter à la main si besoin** : ce que Prisma ne sait pas exprimer (fonctions, triggers, colonnes générées, CHECK, index non décrits par le schéma) s'ajoute ici.
4. **Déployer** : `pnpm db:deploy` (`prisma migrate deploy`) applique les migrations en attente, sans rien recalculer.

Ce flux garantit qu'aucune migration n'est appliquée sans avoir été lue, et qu'un diff inattendu se voit avant d'atteindre la base.

## Rôles PostgreSQL

Deux rôles de connexion, deux URL (détail dans `docs/droits.md`) :

- `elsass_racing` : propriétaire, utilisé par les migrations et les scripts. Superutilisateur en développement.
- `elsass_racing_app_dev` : rôle de l'application, soumis au RLS. Il hérite de `elsass_racing_app` (NOLOGIN), qui porte les droits et les politiques.

Le script `docker/init/01-role-app.sql` crée ces rôles de connexion. Il est monté dans `/docker-entrypoint-initdb.d`, donc il ne tourne qu'à la **création du volume**. Ordre à respecter :

1. Migrations : `pnpm db:deploy` (la migration `core_rls` crée le rôle `elsass_racing_app`).
2. Sur un volume existant, script des rôles, à lancer à la main :

   ```bash
   MSYS_NO_PATHCONV=1 docker compose exec -T postgres psql -U elsass_racing -d elsass_racing -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/01-role-app.sql
   ```

   Le script est idempotent. `MSYS_NO_PATHCONV=1` évite que Git Bash ne réécrive le chemin.

Sur un volume neuf, le script est exécuté au démarrage, avant les migrations : il crée le rôle `elsass_racing_app` lui-même, ce qui rend le `GRANT` valide. La migration `core_rls` reste idempotente sur ce point (`IF NOT EXISTS`).


## Instructions SQL à la main : règle de la base shadow

`pnpm db:migrate` (migrate dev) rejoue toutes les migrations sur une base shadow vide, avant de créer la nouvelle. Une instruction écrite à la main qui touche `_prisma_migrations`, ou un objet absent de cette base vide, casse donc la création de migration, même si la base réelle la supporte.

Règle : toute instruction manuelle de ce genre doit être conditionnelle. Exemple :

```sql
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE "_prisma_migrations" FROM elsass_racing_app;
  END IF;
END
$$;
```

Cas déjà corrigé : la migration `core_rls`. Si une migration déjà appliquée est modifiée, la colonne `checksum` de sa ligne dans `_prisma_migrations` doit être mise à jour (sha256 du fichier, rôle propriétaire). C'est acceptable tant que rien n'est en production.
