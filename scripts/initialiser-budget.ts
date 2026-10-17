// Initialise Budget pour les teams existantes : catégories par défaut, caisse de la team, un payeur par
// membre actif ayant une personne. Idempotent : on peut le relancer sans créer de doublon.
// Usage : pnpm db:initialiser-budget (après pnpm db:deploy, sur chaque base).

import "./lib/env"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"

const url = process.env.DATABASE_URL_MIGRATION
if (!url) {
  console.error("DATABASE_URL_MIGRATION absente.")
  process.exit(1)
}
const bd = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

async function main(): Promise<void> {
  // Import dynamique : Prisma ne doit être chargé qu'une fois l'environnement lu (cf. verifier-bus.ts).
  const { initialiserBudgetDans } = await import("../src/apps/budget/services-serveur")

  const teams = await bd.coreTeam.findMany({ where: { deletedAt: null }, select: { id: true, nom: true } })
  let initialisees = 0
  for (const team of teams) {
    // Le contexte d'une initialisation : un responsable actif de la team, à défaut la team est ignorée.
    const responsable = await bd.coreMembership.findFirst({
      where: { teamId: team.id, role: "responsable", statut: "actif", deletedAt: null },
      select: { id: true, userId: true },
    })
    if (!responsable) {
      console.log(`- ${team.nom} : aucun responsable actif, ignorée.`)
      continue
    }
    await initialiserBudgetDans({ teamId: team.id, userId: responsable.userId, membership: { id: responsable.id, role: "responsable" } })
    initialisees += 1
    console.log(`- ${team.nom} : Budget initialisé.`)
  }
  console.log(`${initialisees} team(s) sur ${teams.length} initialisée(s).`)
}

main()
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => bd.$disconnect())
