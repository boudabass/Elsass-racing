// Données réelles de la team Koehling Racing : véhicule, pilotes, saison 2026, épreuves
// et engagements. Idempotent : chaque ligne est retrouvée par son nom avant d'être créée.
// Refuse si la team n'existe pas (créer la team avant avec pnpm team:creer).
// Usage : pnpm donnees:koehling
//
// Écrit avec le rôle propriétaire (DATABASE_URL_MIGRATION) : ce sont des données de
// team saisies hors contexte utilisateur. Le contenu est dans scripts/lib/donnees-koehling.ts.

import { config as chargerEnv } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { SLUG_KOEHLING, appliquerDonneesKoehling } from "./lib/donnees-koehling"

chargerEnv({ path: ".env.local" })
chargerEnv()

const url = process.env.DATABASE_URL_MIGRATION
if (!url) {
  console.error("DATABASE_URL_MIGRATION absente.")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

async function main() {
  const team = await prisma.coreTeam.findUnique({ where: { slug: SLUG_KOEHLING } })
  if (!team) {
    console.error(`La team « ${SLUG_KOEHLING} » n'existe pas. Lancer d'abord : pnpm team:creer ...`)
    process.exit(1)
  }

  const { epreuves, crees } = await appliquerDonneesKoehling(prisma, team.id)
  console.log(`Team « ${team.nom} » : véhicule, 2 personnes, saison 2026, ${epreuves} épreuves (${crees} créées à cette exécution).`)
}

main()
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
