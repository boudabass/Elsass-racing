// Seed du catalogue : apps et droits par défaut. Idempotent (upsert) : le relancer
// ne crée ni doublon ni ligne en plus. Ne crée ni team, ni compte, ni adhésion.
//
// Lancé par `pnpm db:seed`, et par `prisma migrate reset` (migrations.seed dans
// prisma.config.ts). Les valeurs viennent de src/core/catalogue.ts.

import { PrismaPg } from "@prisma/adapter-pg"
import { config as chargerEnv } from "dotenv"

import { PrismaClient } from "../src/generated/prisma/client"
import { APPS, DROITS_PAR_DEFAUT } from "../src/core/catalogue"

chargerEnv({ path: ".env.local" })
chargerEnv()

const connectionString = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL absente : impossible de lancer le seed.")
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  // Les apps d'abord : core_role_default les référence par clé étrangère.
  for (const app of APPS) {
    await prisma.coreApp.upsert({
      where: { cle: app.cle },
      create: { cle: app.cle, nom: app.nom, icone: app.icone, version: app.version, requiert: [...app.requiert] },
      update: { nom: app.nom, icone: app.icone, version: app.version, requiert: [...app.requiert] },
    })
  }

  for (const droit of DROITS_PAR_DEFAUT) {
    await prisma.coreRoleDefault.upsert({
      where: { role_appCle: { role: droit.role, appCle: droit.appCle } },
      create: { role: droit.role, appCle: droit.appCle, niveau: droit.niveau },
      update: { niveau: droit.niveau },
    })
  }

  console.log(`Seed : ${APPS.length} apps, ${DROITS_PAR_DEFAUT.length} droits par défaut.`)
}

main()
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
