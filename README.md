# Elsass Racing

Plateforme de gestion de team rallye, en PWA Next.js. Elle regroupe plusieurs applications dans une même base de code.

## Prérequis

- Node 22 (la même version que l'image Docker)
- pnpm 11.21.0 (`corepack enable` puis `corepack prepare pnpm@11.21.0 --activate`)
- PostgreSQL

npm n'est pas utilisé dans ce dépôt.

## Commandes

```bash
pnpm install          # installe les dépendances et génère le client Prisma
pnpm dev              # serveur de développement
pnpm typecheck        # contrôle de types
pnpm test             # tests (Vitest)
pnpm build            # build de production
pnpm start            # démarre le build de production
```

Variables d'environnement : copier `.env.example` en `.env.local`.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) : règles de travail et conventions du projet.
- [`docs/`](docs/) : relevé de la stack de référence et plan de développement.
- [`documentation/JOURNAL.md`](documentation/JOURNAL.md) : journal daté des décisions.
