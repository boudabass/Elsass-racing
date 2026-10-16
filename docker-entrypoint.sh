#!/bin/sh
# Applique les migrations en attente, puis démarre l'app.
#
# `set -e` : si une migration échoue, le conteneur ne démarre PAS. Mieux vaut un
# conteneur qui refuse de monter qu'une app qui répond sur un schéma périmé.
set -e

if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL absente : refus de démarrer." >&2
    echo "C'est une variable runtime, à poser dans Coolify." >&2
    exit 1
fi

echo "→ prisma migrate deploy"
# Sous-shell : /opt/prisma-cli reste isolé de /app. Le process final (`exec`)
# garde /app comme répertoire courant.
( cd /opt/prisma-cli && ./node_modules/.bin/prisma migrate deploy )

echo "→ démarrage"
exec "$@"
