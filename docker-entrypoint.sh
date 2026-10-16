#!/bin/sh
# Applique les migrations en attente, puis démarre l'app.
#
# Deux URL : DATABASE_URL (rôle applicatif, soumis au RLS) pour l'app, et
# DATABASE_URL_MIGRATION (rôle propriétaire) pour les migrations. `set -e` : si une
# migration échoue, le conteneur ne démarre PAS.
set -e

if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL absente : refus de démarrer." >&2
    echo "C'est une variable runtime, à poser dans Coolify." >&2
    exit 1
fi

if [ -z "$DATABASE_URL_MIGRATION" ]; then
    echo "DATABASE_URL_MIGRATION absente : refus de démarrer." >&2
    echo "Les migrations exigent le rôle propriétaire, pas le rôle applicatif." >&2
    exit 1
fi

echo "→ prisma migrate deploy"
# Sous-shell : /opt/prisma-cli reste isolé de /app. prisma.config.ts lit
# DATABASE_URL_MIGRATION depuis l'environnement, transmis ici tel quel.
( cd /opt/prisma-cli && ./node_modules/.bin/prisma migrate deploy )

echo "→ démarrage"
exec "$@"
