// Crée une team, son responsable (compte et fiche personne), et active les 11 apps du catalogue.
// Usage : pnpm team:creer --nom "Nom de la team" --slug nom-de-la-team --email adresse@exemple.fr \
//           --prenom-responsable Prénom --nom-responsable Nom
// Refuse si le slug existe déjà. Ne touche à rien d'autre.
// La fiche personne du responsable est obligatoire : sans elle, il n'est ni pilote ni dans les soldes Budget.
// (Les arguments de la personne ne sont pas --nom : --nom désigne la team.)

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
const prenomResponsable = obligatoire(lireArgument("prenom-responsable")?.trim(), "Argument --prenom-responsable manquant.")
const nomResponsable = obligatoire(lireArgument("nom-responsable")?.trim(), "Argument --nom-responsable manquant.")

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

    // Fiche personne du responsable, liée à son compte, puis à son adhésion (pilote, soldes Budget).
    const personneId = newId()
    await tx.corePerson.create({
      data: {
        id: personneId,
        teamId: team.id,
        prenom: prenomResponsable,
        nom: nomResponsable,
        email,
        membreTeam: true,
        userId: utilisateur.id,
      },
    })

    await tx.coreMembership.create({
      data: {
        id: newId(),
        teamId: team.id,
        userId: utilisateur.id,
        personId: personneId,
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

  console.log(`Team « ${nom} » créée (slug ${slug}), ${prenomResponsable} ${nomResponsable} (${email}) responsable, ${APPS.length} apps activées.`)
}

main()
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
