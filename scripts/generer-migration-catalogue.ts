// Écrit sur la sortie standard le SQL du catalogue (apps et droits par défaut), à partir de
// src/core/catalogue.ts. Usage :
//   pnpm exec tsx scripts/generer-migration-catalogue.ts > prisma/migrations/<dossier>/migration.sql
// Le dossier est créé avant par `pnpm exec prisma migrate dev --create-only --name core_catalogue`.
// Le test src/core/catalogue-sql.test.ts vérifie que la dernière migration est à jour.

import { sqlCatalogue } from "../src/core/catalogue-sql"

process.stdout.write(sqlCatalogue())
