// Données réelles de la team Koehling Racing : véhicule, pilotes, saison 2026, épreuves
// et engagements. Idempotent : chaque ligne est retrouvée par son nom avant d'être créée.
// Refuse si la team n'existe pas (créer la team avant avec pnpm team:creer).
// Usage : pnpm donnees:koehling [--slug <slug>]   (défaut : koehling-racing-team)
// Exemple, team de test de production :
//   pnpm donnees:koehling --slug the-elsassisch-racing-team
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

// Slug passé après --slug, sinon celui de la team Koehling.
function lireSlug(): string {
  const index = process.argv.indexOf("--slug")
  const valeur = index >= 0 ? process.argv[index + 1] : undefined
  return valeur && valeur.trim() !== "" ? valeur.trim() : SLUG_KOEHLING
}

async function main() {
  const slug = lireSlug()
  const team = await prisma.coreTeam.findUnique({ where: { slug } })
  if (!team) {
    console.error(`La team « ${slug} » n'existe pas. Lancer d'abord : pnpm team:creer ...`)
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
