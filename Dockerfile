# Étape 1 : build de l'application Next.js.
#
# Node 22 et non 20 : pnpm 11 charge `node:sqlite`, module interne de Node 22.13+.
# Sur node:20, `pnpm install` échoue avec ERR_UNKNOWN_BUILTIN_MODULE.
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /app

# `pnpm-workspace.yaml` porte `allowBuilds` : sans lui, pnpm 11 saute le
# postinstall de Prisma. Le schéma doit exister avant `pnpm install`, car le
# postinstall lance `prisma generate`.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN pnpm install --frozen-lockfile

COPY . .

# Aucune page ne lit la base à la génération, mais le client Prisma (src/lib/prisma.ts) exige
# DATABASE_URL à son chargement, et la collecte des pages charge les modules. Une URL factice,
# posée pour cette seule commande, suffit : le client ne se connecte qu'à la première requête.
# La vraie DATABASE_URL reste une variable runtime, posée dans Coolify.
RUN DATABASE_URL=postgresql://construction:construction@localhost:5432/construction pnpm build

# Étape 2 : image de production.
FROM node:22-alpine

RUN apk add --no-cache ca-certificates

ENV NODE_ENV=production
ENV PORT=3000
# Sans cela, le serveur standalone n'écoute que sur localhost.
ENV HOSTNAME=0.0.0.0
# Dossier des fichiers : point de montage du volume Coolify (STOCKAGE_DIR, cf. src/lib/stockage.ts).
ENV STOCKAGE_DIR=/app/stockage

WORKDIR /app

RUN mkdir -p /app/stockage

# La sortie standalone embarque son propre serveur et les dépendances tracées.
# Elle n'inclut ni public/ ni .next/static : à copier à part.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# La sortie standalone embarque une copie de package.json. `node server.js` ne
# le lit pas : on le retire pour qu'un `npm install` éventuel ne résolve pas
# tout le graphe de dépendances.
RUN rm -f package.json

# Migrations appliquées au démarrage : le conteneur applique lui-même ce qui
# manque avant d'ouvrir le port. Coolify n'applique aucune migration.
#
# La CLI Prisma vit dans /opt/prisma-cli, séparée de /app : binaire, dépendances,
# schéma et config y sont réunis, pour que la résolution de prisma.config.ts
# (dotenv, prisma/config) ne traverse jamais vers /app.
RUN mkdir /opt/prisma-cli
WORKDIR /opt/prisma-cli
RUN npm install --no-save --no-package-lock prisma@7.10.0 dotenv@^17
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
WORKDIR /app

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
