# Journal du projet

## 16/10/2026 : relevé de stack et initialisation du dépôt

- Relevé de la stack d'Elsass Dico, en lecture seule : `docs/stack-reference.md`.
- Initialisation du dépôt : un seul paquet Next.js, versions épinglées sur le Dico (Next 15.5.27, React 19.3.0, Prisma 7.10.0, Tailwind 3 et non 4).
- Ajout de Vitest (3.x) avec le script `test`.
- Structure `src/app`, `src/core`, `src/apps`, `src/components/ui`, `src/components/qg`, `src/lib`, `prisma`, `docs`, `documentation`.
- Composants shadcn repris : alert, badge, card, input, skeleton, table, textarea. Les autres attendent la décision sur Radix (voir le compte-rendu).
- Dockerfile en deux étages, entrypoint avec `prisma migrate deploy`, CLI Prisma isolée dans `/opt/prisma-cli`.
- Aucun modèle Prisma, aucune migration, aucune authentification pour l'instant.
