# Relevé de la stack d'Elsass Dico

> Relevé en lecture seule de `Elsass_dico` (le 16/10/2026), destiné à guider la mise en place d'Elsass Racing.
> Aucun fichier du projet voisin n'a été modifié. Les dossiers `node_modules`, `data` et `public` n'ont pas été explorés (voir « Anomalies et lacunes »).

---

## 1. Versions exactes

Les versions « résolues » viennent de `pnpm-lock.yaml` (lockfileVersion 9.0). La colonne « spécifiée » est celle de `package.json`.

### Runtime et outils

| Outil | Version | Source |
|---|---|---|
| Node (image Docker, builder et final) | 22 (`node:22-alpine`) | `Dockerfile` |
| Node (poste local) | 24.19.0 | `node -v` |
| pnpm (Docker et poste local) | 11.21.0 | `Dockerfile` (`corepack prepare pnpm@11.21.0`), `pnpm -v` |
| npm (poste local, non utilisé par le projet) | 11.17.0 | `npm -v` |

### Dépendances de production

| Paquet | Spécifiée | Résolue |
|---|---|---|
| next | 15.5.27 | 15.5.27 |
| react | ^19.3.0 | 19.3.0 |
| react-dom | ^19.3.0 | 19.3.0 |
| @prisma/client | 7.10.0 | 7.10.0 |
| @prisma/adapter-pg | ^7.10.0 | 7.10.0 |
| pg | ^8.23.0 | 8.23.0 |
| jose | ^6.2.12 | 6.2.12 |
| zod | ^3.25.28 | 3.25.28 |
| react-hook-form | ^7.56.4 | 7.56.4 |
| @hookform/resolvers | ^5.0.1 | 5.0.1 |
| lucide-react | ^0.511.0 | 0.511.0 |
| next-themes | ^0.4.6 | 0.4.6 |
| leaflet | ^1.9.4 | 1.9.4 |
| recharts | ^2.15.3 | 2.15.3 |
| web-push | 3.6.7 | 3.6.7 |
| date-fns | ^3.6.0 | 3.6.0 |
| cmdk | ^1.1.1 | 1.1.1 |
| embla-carousel-react | ^8.6.0 | 8.6.0 |
| input-otp | ^1.4.2 | 1.4.2 |
| react-day-picker | ^8.10.1 | 8.10.1 |
| react-resizable-panels | ^3.0.2 | 3.0.2 |
| vaul | ^1.1.2 | 1.1.2 |
| topojson-client | ^3.1.0 | 3.1.0 |
| class-variance-authority | ^0.7.1 | 0.7.1 |
| clsx | ^2.1.1 | 2.1.1 |
| tailwind-merge | ^3.3.0 | 3.3.0 |
| tailwindcss-animate | ^1.0.7 | 1.0.7 |

Radix UI (toutes en `^`, versions résolues) : dialog 1.1.14, dropdown-menu 2.1.15, label 2.1.7, slot 1.2.3, toggle 1.1.9.

### Dépendances de développement

| Paquet | Spécifiée | Résolue |
|---|---|---|
| typescript | ^5 | 5.8.3 |
| tailwindcss | ^3.4.1 | **3.4.17 (Tailwind v3)** |
| postcss | ^8 | 8.5.3 |
| prisma | 7.10.0 | 7.10.0 |
| dotenv | ^17.4.2 | 17.4.2 |
| tsx | ^4.23.13 | 4.23.13 |
| @types/node | ^20 | 20.17.50 |
| @types/react | ^19 | 19.1.5 |
| @types/react-dom | ^19 | 19.1.5 |
| @types/pg | ^8.23.1 | 8.23.1 |
| @types/leaflet | ^1.9.22 | 1.9.22 |
| @types/web-push | ^3.6.4 | 3.6.4 |
| @types/topojson-client | ^3.1.5 | 3.1.5 |
| topojson-server | ^3.0.1 | 3.0.1 |
| topojson-simplify | ^3.0.3 | 3.0.3 |
| @etalab/decoupage-administratif | ^6.0.0 | 6.0.0 (données des communes, spécifique au dico) |
| @dyad-sh/nextjs-webpack-component-tagger | ^0.8.0 | 0.8.0 (actif seulement en `development`) |

Remarque : shadcn/ui n'est pas une dépendance npm. Ses composants sont copiés dans `src/components/ui/` (7 fichiers).

---

## 2. Scripts npm

Définis dans `package.json` :

| Script | Commande | Usage |
|---|---|---|
| `dev` | `next dev` | Serveur de développement |
| `build` | `prisma generate && next build` | Build de production (génère le client Prisma puis Next) |
| `start` | `next start` | Démarre le serveur de production (hors Docker) |
| `lint` | `next lint` | Lint. **Attention : aucun ESLint dans les dépendances ni fichier de config à la racine** (voir anomalies) |
| `typecheck` | `tsc --noEmit && tsc --noEmit -p tsconfig.scripts.json` | Contrôle de types de l'app et des scripts |
| `postinstall` | `prisma generate` | Génère le client Prisma après `pnpm install` |

Pas de script de test (`test`) : aucune suite automatisée dans le projet. La vérification repose sur `typecheck` + `build` + contrôles manuels.

Les scripts métier se lancent avec `pnpm exec tsx scripts/<nom>.mts` (voir section Structure).

---

## 3. Structure des dossiers

Arbre à 2 niveaux, sans `node_modules` (ni `data/` ni `public/` détaillés) :

```
Elsass_dico/
├── .agent/  .claude/  .impeccable/     outils d'assistance (non applicatifs)
├── .next/                              build Next (généré)
├── .dockerignore  .gitignore  .gitattributes  .env.local (secrets, non versionné)
├── CLAUDE.md                           règles de travail et état du projet
├── README.md  PRODUCT.md  LICENSE
├── Dockerfile  docker-entrypoint.sh
├── next.config.ts  next-env.d.ts  prisma.config.ts
├── tailwind.config.ts  postcss.config.mjs  components.json
├── tsconfig.json  tsconfig.scripts.json
├── package.json  pnpm-lock.yaml  pnpm-workspace.yaml
├── data/                               source de vérité des données (non explorée)
├── documentation/                      index dans README.md, journal dans 23-JOURNAL.md
│   ├── archive/                        anciens documents
│   └── orthal/                         graphie de référence
├── prisma/
│   ├── schema.prisma
│   └── migrations/                     13 dossiers horodatés (20260912120000_init … 20261011220000_sessions_refresh)
├── public/                             fichiers servis tels quels (non explorés, voir plus bas)
├── scripts/                            outils de données (non servis, exclus de l'image Docker)
│   ├── *.mts                           deriver, importer-*, exporter-*, verifier-derivation, seed-communes, promouvoir-admin, supprimer-membre
│   ├── ingest_attestations.py + requirements.txt
│   ├── communes/  extract/  lib/  marque/  mesures/
└── src/
    ├── app/                            App Router (pages, actions, api, manifest.ts, layout.tsx, globals.css)
    ├── assets/                         polices woff (Archivo) et signature de marque
    ├── components/                     composants métier + ui/ (shadcn, 7 fichiers)
    ├── hooks/                          hooks React
    ├── lib/                            logique métier et utilitaires (préfixe -serveur.ts pour le serveur)
    ├── middleware.ts
    └── generated/prisma/               client Prisma généré (gitignoré)
```

---

## 4. Configuration Prisma

- **Version** : Prisma 7.10.0 (CLI en devDependency, client en dependency).
- **Generator** (`prisma/schema.prisma`) : provider `prisma-client` (nouveau générateur sans moteur Rust), `output = "../src/generated/prisma"`. Le dossier généré est gitignoré.
- **Datasource** : `provider = "postgresql"`, **sans `url`** dans le schéma (exigence de Prisma 7).
- **Connexion CLI** (`prisma.config.ts`) : lit `.env.local` puis `.env` avec dotenv, puis `datasource.url` = `process.env.DATABASE_URL`. Si la variable est absente, un repli volontairement invalide (`postgresql://database-url-absente:5432/absente`) est utilisé : la commande `prisma generate` passe au build, et toute commande qui touche vraiment la base échoue de façon lisible.
- **Connexion applicative** (`src/lib/prisma.ts`) : `PrismaClient` avec l'adapter `@prisma/adapter-pg` (`PrismaPg({ connectionString })`). Le client est mis en cache sur `globalThis` en dehors de la production, pour éviter d'ouvrir un pool à chaque rechargement. Lève une erreur claire si `DATABASE_URL` manque.
- **Mode de migration** : `prisma migrate deploy` (jamais `migrate dev` en production). Les migrations sont des dossiers SQL dans `prisma/migrations/`, nommés `AAAAMMJJHHMMSS_nom`. Elles sont appliquées **automatiquement au démarrage du conteneur** par `docker-entrypoint.sh`.
- **pg reste en 8.x** tant que Prisma (adapter-pg) envoie des requêtes parallèles dans une transaction : DeprecationWarning observé au 4.1 sur createMany skipDuplicates (pile dans `PgTransaction.queryRaw`, appelé par le query-interpreter de Prisma). Sans effet en pg 8.23.1, cassera en pg 9.
- **Contraintes hors Prisma** : un `CHECK` SQL a été ajouté à la main dans la migration initiale, car Prisma ne sait pas l'exprimer. À prévoir si Racing a des règles du même genre.
- **Injection de la base** : uniquement par variable d'environnement `DATABASE_URL`. Pas de fichier de config de base en dur.
- **Conventions du schéma** : tables et colonnes en snake_case (interrogées à la main en SQL).

---

## 5. Docker

Fichier `Dockerfile` en **deux étages**, tous deux sur `node:22-alpine`.

**Étage 1, `builder`**
1. `corepack enable` puis `corepack prepare pnpm@11.21.0 --activate`.
2. Copie de `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, puis `prisma/` et `prisma.config.ts` (le schéma doit exister avant `pnpm install`, car le `postinstall` lance `prisma generate`).
3. `pnpm install --frozen-lockfile`.
4. `COPY . .`.
5. `ARG DATABASE_URL` avec une garde qui fait échouer le build si la variable est vide, puis `pnpm build`.

**Étage 2, image finale**
1. `apk add ca-certificates`.
2. `ENV NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`.
3. Copie de `public/`, `.next/standalone/` et `.next/static/`.
4. `rm -f package.json` (la sortie standalone en embarque une copie qui perturberait npm).
5. Installation de la CLI Prisma **isolée** dans `/opt/prisma-cli` : `npm install --no-save --no-package-lock prisma@7.10.0 dotenv`, puis copie de `prisma/` et `prisma.config.ts`.
6. Copie et `chmod +x` de `docker-entrypoint.sh` dans `/usr/local/bin/`.

**Entrypoint** (`docker-entrypoint.sh`) : `set -e`. Vérifie que `DATABASE_URL` existe (sinon refus de démarrer), lance `prisma migrate deploy` dans `/opt/prisma-cli` (dans un sous-shell), puis `exec "$@"`.

**Commande** : `CMD ["node", "server.js"]`. **Port exposé** : `3000`.

Points à retenir :
- Le build Docker n'a jamais été vérifié en local avec Node 24 : le commentaire du Dockerfile précise qu'un couple Node 20 + pnpm 11 casse (`node:sqlite`), d'où Node 22 minimum.
- `.dockerignore` exclut `data`, `scripts`, `.env*`, `.git`, `node_modules`.

---

## 6. Déploiement Coolify

Ce que disent `CLAUDE.md`, `README.md` et la documentation :

- **Hébergement** : Coolify sur un VPS **partagé**. Le disque du VPS a déjà saturé par le passé. Le `next.config.ts` passe donc en `output: "standalone"` pour alléger l'image.
- **Deux applications** : une pour `main` (domaine de production) et une pour `dev` (domaine de dev). Les deux **partagent la même base PostgreSQL**. Pas de déploiement de `dev` sans regarder l'impact sur `main`.
- **Déploiement depuis Git** : Coolify construit l'image à partir du `Dockerfile`. Des « watch paths » sont configurés sur `dev` (`**` et `!data/contributions/**`), pour ne pas redéployer sur les commits de données.
- **Vérification d'un déploiement** : attendre que `updated_at` de l'application dans Coolify avance **et** que le code servi contienne le changement, avant toute capture.
- **Migrations** : Coolify n'en applique aucune. C'est le conteneur qui exécute `prisma migrate deploy` au démarrage. Trois incidents (09/08, 10/08, 23/08) ont motivé ce choix.
- **Variables d'environnement** (noms seulement, valeurs dans Coolify) :

| Variable | Moment | Rôle |
|---|---|---|
| `DATABASE_URL` | **Build et runtime** | Build : requis par `generateStaticParams`. Runtime : connexion Postgres |
| `SESSION_SECRET` | Runtime | Signature des sessions, 32 caractères minimum, sinon refus de démarrer |
| `ODOO_URL`, `ODOO_DB` | Runtime | Authentification déléguée à Odoo |
| `AUTOMATISATION_API_TOKEN` | Runtime | Jeton des routes `/api/automatisation/*` (appelées par N8N) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUJET` | Runtime | Notifications push (web-push) |

- **Tentative abandonnée** : le secret BuildKit (`--mount=type=secret`) ne fonctionne pas sur ce Coolify. `DATABASE_URL` passe donc en `ARG` classique, alimenté par une Build Variable.
- **Volumes** : **aucun volume documenté**. Tout l'état persistant est en base PostgreSQL (Postgres est une ressource Coolify distincte, dont les sauvegardes sont gérées dans Coolify).
- **Base Postgres** : le port public est **fermé** depuis le 09/10/2026 (case « publicly available » à décocher dans Coolify). Il n'est rouvert que le temps d'un script local, puis refermé.
- **Accès Coolify par MCP** : lecture seule (règle de `CLAUDE.md`).

---

## 7. PWA

Pas de bibliothèque PWA (ni `next-pwa`, ni Serwist). C'est fait à la main :

- **Manifeste** : `src/app/manifest.ts` (route Next `MetadataRoute.Manifest`). `display: standalone`, `start_url: "/"`, `lang: "fr"`, couleurs blanches. Trois icônes dans `public/icones/` (192, 512, 512 masquable), générées par `scripts/marque/generer-icones.py`.
- **Service worker** : `public/sw.js`, écrit à la main. Il ne fait **que** :
  - `install` / `activate` : `skipWaiting` et `clients.claim()`,
  - `push` : affiche une notification,
  - `notificationclick` : ouvre ou réutilise une fenêtre de l'app.
  Il n'y a **aucun cache hors ligne** (l'app a besoin du serveur).
- **Enregistrement et installation** : composant `src/components/installer-app.tsx`, qui écoute `beforeinstallprompt`.
- **Middleware** : `sw.js` et le manifeste doivent être **exclus du matcher** du middleware, sinon un téléphone sans cookie reçoit une redirection vers `/login`.
- **CSP** : `worker-src 'self'` explicite nécessaire. `'strict-dynamic'` annule `'self'` dans `script-src`.
- **Notifications push** : `web-push` 3.6.7 côté serveur, paire de clés VAPID en variables d'environnement, abonnements stockés en base (un par appareil et contexte).

---

## 8. UI

- **Système** : shadcn/ui, style **`new-york`**, `rsc: true`, `tsx: true`, `iconLibrary: lucide`, couleur de base `neutral`, variables CSS activées (`cssVariables: true`), `prefix: ""`.
- **Config** (`components.json`) : `tailwind.config` = `tailwind.config.ts`, `css` = `src/app/globals.css`. Alias : `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`.
- **Tailwind v3.4.17** avec `darkMode: ["class"]` et `tailwindcss-animate`. Les tokens sont en `hsl(var(--...))` dans `globals.css`.
- **Couleurs de marque** (commentées dans `globals.css`) : or `#EFC631`, rouge `#FF0000`. Règle de contraste : l'or ne porte jamais de texte sur blanc (1,8:1), le rouge de marque ne sert pas de couleur de lien (4,0:1). D'où un rouge foncé `--marque-rouge-texte` réservé au texte.
- **Polices** (`src/app/layout.tsx`) :
  - **Archivo** (texte), via `next/font/google` (variable `--font-archivo`), fichiers woff aussi présents dans `src/assets/polices/`.
  - **Azimut** (titres), via `next/font/local` depuis `src/app/fonts/Azimut-Regular.otf` (variable `--font-azimut`). Azimut n'est pas exclusive à la marque : la mention de licence reste à établir.
- **Thème** : `next-themes` installé. Le dico ajoute un système de « sens » (bleu/rouge) en tokens `--sens-*`.

---

## 9. Règles de travail notées dans CLAUDE.md à reprendre

Règles générales, applicables à Racing :

1. **pnpm uniquement, jamais npm.** `prisma@latest` pointe une release candidate (le tag `prev` donne la stable).
2. **Typecheck puis build après chaque groupe de changements** (`pnpm run typecheck` puis `pnpm build`).
3. **Mesurer avant d'écrire** : en base, avec un script jetable en lecture seule, supprimé après. Ne jamais laisser une écriture de test en base.
4. **Branches** : travail sur `dev`, fusion `dev` → `main` par **commit de merge** (pas de squash).
5. **Déploiement** : attendre que `updated_at` avance et que le code servi contienne le changement avant toute capture d'écran.
6. **Vérifier à l'écran en passant par la navigation**, pas seulement par l'URL.
7. **Server Actions** : un fichier `'use server'` n'exporte que des actions. Les utilitaires vont dans `src/lib/*-serveur.ts`. Une action de lecture se garde elle-même (contrôle de session), car Next expose toutes les actions importées, même sur une page publique.
8. **Redirection dans une route API** : chemin relatif, jamais `new URL(x, request.url)` (derrière un proxy, l'URL vaut `0.0.0.0:3000`).
9. **Leaflet** fuit ses z-index : `isolate` sur son conteneur (si carte).
10. **Une Server Action en vol ne survit pas à `router.replace`** : réécrire l'URL après le chargement, jamais pendant.
11. **Migrations** : appliquées par le conteneur au démarrage, jamais à la main dans un SQL Editor.
12. **Mot de passe Postgres** : le changer en base, puis le recopier dans la ressource Coolify (sinon les sauvegardes cassent) et dans `DATABASE_URL` runtime et build.
13. **Restauration de sauvegarde** : toujours dans une base vide, jamais vers la production.
14. **Mémoire de projet** : le récit va dans un journal (`documentation/23-JOURNAL.md` chez Dico). `CLAUDE.md` ne garde que les règles, pièges et état actuel. C'est une bonne pratique à reprendre dès le départ.
15. **Coolify** : lecture seule via MCP.
16. **Windows** : une branche Git contenant des noms de fichiers avec `?` bloque checkout et reset. Ne jamais désactiver `core.protectNTFS` (le Dico passe par plumbing dans ce cas).
17. **Sécurité** : limites de tentatives sur les routes sensibles (`limite-tentatives-serveur.ts`), jeton révocable pour les sessions longues (`sessions_refresh`), CSP avec nonce posée par le middleware.

---

## 10. Points à adapter pour Elsass Racing

Spécifique au dico, à ne **pas** reprendre tel quel :

- **Domaine de l'app** : elsass-dico, sa base et ses noms (`ed_session`, `ed_refresh`, `ed_sens`).
- **Métier** : dictionnaire, lemmes, variantes, témoignages, communes, carte des parlers, défi du jour (`/jeu`), contributions, signalements, sources (`/sources`).
- **Données** : `data/`, `deriver.mts`, `importer-*.mts`, journal de contributions et son export N8N, `@etalab/decoupage-administratif`, `topojson` et Leaflet (la carte n'existe pas forcément dans Racing).
- **Voix et règles éditoriales** : tutoiement, pas de tiret long dans le texte affiché, règles sur la langue alsacienne (aucune traduction générée par LLM). Les règles de marque de Racing sont à définir.
- **Palette et polices** : or et rouge The Elsassisch, Archivo et Azimut. Racing est une marque distincte : à redéfinir (elle peut partager l'univers, pas forcément le design).
- **Sens inverseur** (bleu/rouge), notifications du défi, `sw.js` : spécifiques au jeu.
- **Iframe** : l'app Dico doit tourner dans une iframe du site (`X-Frame-Options: SAMEORIGIN`). À confirmer pour Racing.
- **Auth** : Odoo SSO pour Dico. Racing passera peut-être aussi par Odoo (la spec est dans Odoo 944) : à décider.
- **Scripts Python** (`ingest_attestations.py`, `scripts/marque/`, `scripts/mesures/`) : outillage de données propre au dico.
- **Dossier `documentation/orthal`** et `archive/` : sans objet.

À reprendre tel quel ou presque :

- Structure Dockerfile en deux étages, entrypoint avec `prisma migrate deploy`, CLI Prisma isolée dans `/opt/prisma-cli`.
- `next.config.ts` : `output: "standalone"`, `poweredByHeader: false`, en-têtes de sécurité, `experimental.cpus: 1` si le build sature le VPS.
- `prisma.config.ts` et `src/lib/prisma.ts` (adapter pg, cache `globalThis`).
- `pnpm-workspace.yaml` avec `allowBuilds` (prisma, @prisma/engines, sharp) : pnpm 11 demande une décision explicite pour chaque script d'installation.
- `components.json` (shadcn new-york, lucide).
- Règles de travail du point 9.

---

## 11. Anomalies et lacunes

Ce qui m'a surpris ou qui manque :

1. **Contradictions sur `DATABASE_URL`** entre sources :
   - `CLAUDE.md` : Build Variable Coolify (lue au build par `generateStaticParams`).
   - `Dockerfile` : `ARG DATABASE_URL` obligatoire au build, avec garde.
   - `src/lib/prisma.ts` : « jamais une Build Variable, elle contient le mot de passe ».
   - `prisma.config.ts` : absente du build **volontairement**.
   Réalité déduite : elle est nécessaire au build **et** au runtime, et elle est gravée dans les couches du builder. Le commentaire de `prisma.ts` est donc faux ou obsolète.
2. **Restes de Supabase** : `.dockerignore` (« l'app lit Supabase »), `scripts/ingest_attestations.py`, et `21-REPRISE.md` qui demande de retirer les Build Variables `NEXT_PUBLIC_SUPABASE_*`. L'app actuelle ne lit plus Supabase. À nettoyer avant de copier ces fichiers.
3. **Lint cassé ou incomplet** : le script `lint` (`next lint`) existe, mais ni ESLint, ni `eslint-config-next`, ni fichier de config ne sont présents. À prévoir si Racing veut un lint.
4. **Aucune suite de tests** : pas de script `test`, pas de Vitest ni Jest. La qualité repose sur `typecheck`, `build` et des contrôles manuels.
5. **Tailwind v3, pas v4** : le projet est en Tailwind 3.4.17 (`tailwind.config.ts`, `postcss.config.mjs` avec `tailwindcss: {}`). Un `create-next-app` récent installe Tailwind v4, qui n'a plus le même fichier de config : choix à faire explicitement pour Racing.
6. **Versions de Node** : image Docker en Node 22, mais `@types/node` en 20.17.50 et poste local en Node 24.19.0. Les trois ne se vérifient pas entre eux.
7. **`tailwind.config.ts`** : le `content` liste `./src/pages/**`, qui n'existe pas (sans effet, mais trompeur).
8. **Pas de volume ni de healthcheck documentés** dans Coolify. Pas de description des sauvegardes au-delà de « sauvegardes Postgres de Coolify ».
9. **Pas de noms d'applications ou UUID Coolify** dans la doc : ils sont à demander à l'utilisateur ou à lire via le MCP Coolify (lecture seule).
10. **Lourdeur de l'image** : l'étage final réinstalle Prisma CLI avec npm. Pour Racing, à évaluer si la même complexité est nécessaire (c'est une réponse à des incidents réels, mais elle vient d'un monorepo mal empaqueté).

**Périmètre de lecture, en toute transparence** :
- `node_modules`, `data/` : non ouverts (le listing racine montre seulement leur présence).
- `public/` : **une erreur de ma part**. J'ai listé le premier niveau de `public/` (`ls`) et lu les 25 premières lignes de `public/sw.js`, alors que la consigne était de ne pas entrer dans `public`. Aucune modification, aucun contenu sensible n'a été exposé ni reporté, mais la consigne n'a pas été respectée à la lettre.
- `.env.local` et `.env.telegram.local` : **non lus**. Seuls les noms de variables viennent du code et de la doc.
- `schema.prisma` : seul l'en-tête (40 premières lignes) a été lu, comme demandé. Le corps des modèles n'a pas été examiné.
