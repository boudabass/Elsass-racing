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
