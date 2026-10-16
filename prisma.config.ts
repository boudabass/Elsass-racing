import { config as chargerEnv } from "dotenv"
import { defineConfig } from "prisma/config"

// Les secrets vivent dans `.env.local` (jamais commité). `.env` est lu ensuite,
// en repli, comme dans le Dico.
chargerEnv({ path: ".env.local" })
chargerEnv()

// Prisma 7 : la CLI (migrate, db, studio) lit sa connexion ici, pas dans le
// bloc `datasource` du schéma. Le client applicatif passe par l'adapter
// `@prisma/adapter-pg` (cf. src/lib/prisma.ts).
// `prisma generate` tourne pendant le build de l'image, où DATABASE_URL n'existe
// pas : la variable n'est pas exposée au build pour ne pas graver le mot de
// passe dans l'image. `env()` exigerait la variable et ferait échouer le build,
// d'où ce repli. Il est bruyant exprès : une commande qui touche réellement la
// base (migrate, studio) échouera sur un hôte nommé `database-url-absente`.
// Les migrations passent par le rôle propriétaire (DATABASE_URL_MIGRATION). Le rôle
// applicatif (DATABASE_URL) n'a pas le droit de modifier le schéma, et il est soumis au RLS.
const url =
    process.env.DATABASE_URL_MIGRATION ??
    process.env.DATABASE_URL ??
    "postgresql://database-url-absente:5432/absente"

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: { url },
    // Lancé par `prisma migrate reset` après les migrations (et par `pnpm db:seed`).
    migrations: {
        seed: "tsx prisma/seed.ts",
    },
})
