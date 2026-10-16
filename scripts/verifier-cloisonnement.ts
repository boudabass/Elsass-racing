// Vérifie le cloisonnement par team (RLS) avec le rôle applicatif réel.
// Usage : pnpm db:verifier-rls
//
// Les données de test sont créées avec le rôle propriétaire (DATABASE_URL_MIGRATION),
// puis lues et modifiées avec le client applicatif (DATABASE_URL). Elles sont supprimées
// dans un finally, même en cas d'échec. Sortie : une ligne par contrôle ; exit 1 au
// premier écart.

import { randomUUID } from "node:crypto"

import { config as chargerEnv } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"

chargerEnv({ path: ".env.local" })
chargerEnv()

const urlProprietaire = process.env.DATABASE_URL_MIGRATION
if (!urlProprietaire) {
  console.error("DATABASE_URL_MIGRATION absente : impossible de préparer les données de test.")
  process.exit(1)
}

const proprietaire = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlProprietaire }) })

class EcartCloisonnement extends Error {}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartCloisonnement(`${libelle}${detail ? ` (${detail})` : ""}`)
  console.log(`OK     ${libelle}`)
}

async function main() {
  // Import dynamique : .env.local doit être chargé avant la création du client applicatif.
  const { prisma: applicatif, prismaPourCompte, prismaPourTeam } = await import("../src/lib/prisma")

  const suffixe = randomUUID().slice(0, 8)
  const teamA = { id: randomUUID(), nom: `Verif A ${suffixe}`, slug: `verif-a-${suffixe}` }
  const teamB = { id: randomUUID(), nom: `Verif B ${suffixe}`, slug: `verif-b-${suffixe}` }
  const utilisateur = { id: randomUUID(), email: `verif-${suffixe}@exemple.invalid` }
  const saisonA = randomUUID()
  const saisonB = randomUUID()
  const adhesion = randomUUID()

  try {
    // Données de test, rôle propriétaire (hors contexte de team).
    await proprietaire.coreTeam.createMany({
      data: [
        { id: teamA.id, nom: teamA.nom, slug: teamA.slug },
        { id: teamB.id, nom: teamB.nom, slug: teamB.slug },
      ],
    })
    await proprietaire.coreSeason.createMany({
      data: [
        { id: saisonA, teamId: teamA.id, annee: 2026, nom: "Saison A", dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-12-31") },
        { id: saisonB, teamId: teamB.id, annee: 2026, nom: "Saison B", dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-12-31") },
      ],
    })
    await proprietaire.coreUser.create({ data: { id: utilisateur.id, email: utilisateur.email } })
    await proprietaire.coreMembership.create({
      data: { id: adhesion, teamId: teamA.id, userId: utilisateur.id, role: "responsable", statut: "actif" },
    })

    // 1. Le rôle applicatif n'est ni superutilisateur, ni propriétaire.
    const [role] = await applicatif.$queryRaw<Array<{ rolsuper: boolean }>>`
      SELECT rolsuper FROM pg_roles WHERE rolname = current_user`
    controle("le rôle applicatif n'est pas superutilisateur", role.rolsuper === false)

    // 2. Sans contexte de team, aucune saison n'est visible (refus par défaut).
    const sansContexte = await applicatif.coreSeason.count({ where: { teamId: { in: [teamA.id, teamB.id] } } })
    controle("sans contexte de team, aucune saison visible", sansContexte === 0, `vu : ${sansContexte}`)

    // 3. Sous le contexte de la team A, seule sa saison est visible.
    const clientA = prismaPourTeam(teamA.id, utilisateur.id)
    const saisonsVues = await clientA.coreSeason.findMany({ select: { id: true } })
    controle(
      "findMany sans filtre sous le contexte A renvoie une seule saison, celle de A",
      saisonsVues.length === 1 && saisonsVues[0].id === saisonA,
      `vu : ${saisonsVues.length}`,
    )

    // 4. Une modification de la saison de B, sous le contexte A, ne touche aucune ligne.
    const modifies = await clientA.coreSeason.updateMany({ where: { id: saisonB }, data: { nom: "piratée" } })
    controle("update de la saison de B sous le contexte A touche 0 ligne", modifies.count === 0, `touché : ${modifies.count}`)
    const saisonBIntacte = await proprietaire.coreSeason.findUnique({ where: { id: saisonB }, select: { nom: true } })
    controle("la saison de B est restée intacte", saisonBIntacte?.nom === "Saison B")

    // 5. Une création avec teamId B, sous le contexte A, est refusée par la base.
    let refusee = false
    let message = ""
    try {
      await clientA.coreSeason.create({
        data: {
          id: randomUUID(),
          teamId: teamB.id,
          annee: 2027,
          nom: "Intrusion",
          dateDebut: new Date("2027-01-01"),
          dateFin: new Date("2027-12-31"),
        },
      })
    } catch (erreur) {
      refusee = true
      message = erreur instanceof Error ? erreur.message : String(erreur)
    }
    controle("création dans la team B sous le contexte A refusée par la base", refusee)
    controle("le refus vient du RLS", /row.level security/i.test(message), message.slice(0, 120))

    // 6. Le compte voit ses teams actives, et seulement celles-là.
    const teamsDuCompte = await prismaPourCompte(utilisateur.id).coreTeam.findMany({
      where: { id: { in: [teamA.id, teamB.id] } },
      select: { id: true },
    })
    controle(
      "le compte voit la team où il est membre, et pas celle où il ne l'est pas",
      teamsDuCompte.length === 1 && teamsDuCompte[0].id === teamA.id,
      `vu : ${teamsDuCompte.length}`,
    )

    // 7. La table des migrations n'est pas lisible par le rôle applicatif.
    let migrationsLisibles = true
    try {
      await applicatif.$queryRaw`SELECT count(*) FROM "_prisma_migrations"`
    } catch {
      migrationsLisibles = false
    }
    controle("_prisma_migrations n'est pas lisible par le rôle applicatif", !migrationsLisibles)

    // 8. Aucune table publique avec une colonne team_id ne doit être sans RLS.
    const sansRls = await proprietaire.$queryRaw<Array<{ table_name: string }>>`
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN pg_class k ON k.relname = c.table_name
      JOIN pg_namespace n ON n.oid = k.relnamespace AND n.nspname = c.table_schema
      WHERE c.table_schema = 'public' AND c.column_name = 'team_id' AND NOT k.relrowsecurity
      ORDER BY c.table_name`
    controle(
      "toute table avec team_id a le RLS activé",
      sansRls.length === 0,
      sansRls.map((r) => r.table_name).join(", "),
    )

    console.log("\nCloisonnement vérifié : tous les contrôles passent.")
  } finally {
    // Nettoyage avec le rôle propriétaire, dans l'ordre des clés étrangères.
    await proprietaire.coreMembership.deleteMany({ where: { id: adhesion } })
    await proprietaire.coreSeason.deleteMany({ where: { id: { in: [saisonA, saisonB] } } })
    await proprietaire.coreTeam.deleteMany({ where: { id: { in: [teamA.id, teamB.id] } } })
    await proprietaire.coreUser.deleteMany({ where: { id: utilisateur.id } })
    await proprietaire.$disconnect()
  }
}

main()
  .then(() => process.exit(0))
  .catch((erreur) => {
    if (erreur instanceof EcartCloisonnement) {
      console.error(`ECHEC  ${erreur.message}`)
    } else {
      console.error("ERREUR", erreur)
    }
    process.exit(1)
  })
