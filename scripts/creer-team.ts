// Crée une team, son responsable, et active les 11 apps du catalogue.
// Usage : pnpm team:creer --nom "Nom de la team" --slug nom-de-la-team --email adresse@exemple.fr
// Refuse si le slug existe déjà. Ne touche à rien d'autre.

import { config as chargerEnv } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { APPS } from "../src/core/catalogue"
import { newId } from "../src/core/ids"
import { schemaEmail } from "../src/core/auth/jetons"

chargerEnv({ path: ".env.local" })
chargerEnv()

function lireArgument(nom: string): string | undefined {
  const index = process.argv.indexOf(`--${nom}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function sortirAvecErreur(message: string): never {
  console.error(message)
  process.exit(1)
}

function obligatoire(valeur: string | undefined, message: string): string {
  if (!valeur) sortirAvecErreur(message)
  return valeur
}

const nom = obligatoire(lireArgument("nom")?.trim(), "Argument --nom manquant.")
const slug = obligatoire(lireArgument("slug")?.trim(), "Argument --slug manquant.")
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  sortirAvecErreur("Argument --slug invalide (minuscules, chiffres et tirets).")
}
const analyseEmail = schemaEmail.safeParse(obligatoire(lireArgument("email"), "Argument --email manquant."))
if (!analyseEmail.success) sortirAvecErreur("Argument --email invalide.")
const email = analyseEmail.data

const connectionString = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
if (!connectionString) sortirAvecErreur("DATABASE_URL absente (ni DATABASE_URL_MIGRATION).")

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

async function main() {
  const existante = await prisma.coreTeam.findUnique({ where: { slug } })
  if (existante) sortirAvecErreur(`La team « ${slug} » existe déjà : rien n'a été créé.`)

  const utilisateur = await prisma.coreUser.upsert({
    where: { email },
    update: {},
    create: { id: newId(), email },
  })

  await prisma.$transaction(async (tx) => {
    const team = await tx.coreTeam.create({
      data: { id: newId(), nom, slug, statut: "active" },
    })

    await tx.coreMembership.create({
      data: {
        id: newId(),
        teamId: team.id,
        userId: utilisateur.id,
        role: "responsable",
        statut: "actif",
      },
    })

    // L'ordre suit le catalogue : settings reste en dernier.
    await tx.coreTeamApp.createMany({
      data: APPS.map((app, index) => ({
        id: newId(),
        teamId: team.id,
        appCle: app.cle,
        activee: true,
        versionInstallee: app.version,
        ordre: index + 1,
      })),
    })
  })

  console.log(`Team « ${nom} » créée (slug ${slug}), ${email} responsable, ${APPS.length} apps activées.`)
}

main()
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
