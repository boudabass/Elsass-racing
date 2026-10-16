# Journal du projet

## 16/10/2026 : relevé de stack, initialisation du dépôt, base locale

- Relevé de la stack d'Elsass Dico, en lecture seule : `docs/stack-reference.md`.
- Initialisation du dépôt : un seul paquet Next.js, versions épinglées sur le Dico (Next 15.5.27, React 19.3.0, Prisma 7.10.0, Tailwind 3 et non 4).
- Radix UI (versions en `^`), sonner, 30 composants shadcn Radix, sonner et `use-mobile`. Non copiés : `form.tsx` (attend react-hook-form, tâche 1.10), `calendar`, `carousel`, `chart`, `command`, `drawer`, `input-otp`, `resizable`, `list-skeleton`.
- Vitest 3.x avec `passWithNoTests`, `outputFileTracingRoot` dans `next.config.ts`.
- Structure `src/app`, `src/core`, `src/apps`, `src/components/ui`, `src/components/qg`, `src/lib`, `prisma`, `docs`, `documentation`.
- Dockerfile en deux étages, entrypoint avec `prisma migrate deploy`, CLI Prisma isolée dans `/opt/prisma-cli`.
- Base locale : `docker-compose.yml` (PostgreSQL 16 alpine, port hôte 5433, volume `elsass-racing-pgdata`, healthcheck). Usage développement uniquement. Scripts `db:up`, `db:down`, `db:migrate`, `db:deploy`, `db:studio`.
- Socle : `newId()` (UUID v7, paquet `uuid` 11.x) dans `src/core/ids.ts`. Conventions du schéma dans `docs/conventions-schema.md`, contrôlées par `src/core/schema-conventions.test.ts`.
- Premier modèle : `CoreTeam` ↔ `core_team`, avec l'enum `CoreTeamStatut`. Migration `20261016141250_init_core_team`, appliquée sur la base locale.
- Aucune authentification, aucun middleware, aucun manifest pour l'instant.
- Schéma plateforme et accès : `CoreUser`, `CoreAuthToken`, `CoreInvitation`, `CoreDevice`, `CoreMembership`, `CoreApp`, `CoreTeamApp`, `CoreRoleDefault`, `CoreAppAccess`, avec les enums `CoreRole`, `CoreAccessLevel`, `CoreMembershipStatut`, `CoreAuthTokenType`. Migration `20261016141717_core_plateforme_acces`, avec le CHECK « email ou téléphone » d'invitation ajouté à la main.
- Catalogue : 11 apps et 44 droits par défaut dans `src/core/catalogue.ts` (source unique), écrits en base par `prisma/seed.ts` (`pnpm db:seed`, idempotent, lancé aussi par `migrate reset`). Aucune team, aucun compte, aucune adhésion créés.
- Référentiels partagés : `CorePerson`, `CoreSeason`, `CoreEvent`, `CoreEventEntry`, `CoreVehicle`, `CoreContact`, `CoreTag`, avec les enums `CoreEventType`, `CoreEventStatut`, `CoreEntryStatut`, `CoreVehicleType`, `CoreContactCategorie`. Migration `20261016142106_core_referentiels`. Relations `personId` de `CoreInvitation` et `CoreMembership` branchées vers `CorePerson`, et les deux index manquants de 1.3 ajoutés (`core_device.user_id`, `core_invitation.envoyee_par_user_id`).
- Services transversaux : `CoreFile`, `CoreAttachment`, `CoreActivity`, `CoreNote`, `CoreTask`, `CoreAlert`, `CoreAction`, `CoreNotification`, `CoreNotificationPref`, `CoreDomainEvent`, `CoreEventDelivery`, `CoreSyncCursor`, `CoreSearchIndex`, `CoreExport`, avec 9 enums. Migration `core_services` : colonne `vecteur` générée et index GIN ajoutés à la main. Liens `logoFile`, `photo` branchés vers `core_file`. Inventaire des 31 tables dans `docs/schema-core.md`.
