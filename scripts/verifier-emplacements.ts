// Vérifie la migration des emplacements (brief 4.3e, décision 1, option A) sur la base réelle.
// Usage : pnpm db:verifier-emplacements
//
// La migration est déjà appliquée par db:deploy, sur une base vide. Ce script crée les états à migrer (voiture sans
// organe, sept organes sans position comme team-test-lot-2, voiture déjà positionnée, voiture en conflit, organe sans
// position retiré), relance le SQL de la migration deux fois et contrôle le résultat. Tout est supprimé dans un finally.
// Une ligne par contrôle ; exit 1 au premier écart.

import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

import { config as chargerEnv } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { TYPES_DEFAUT } from "../src/apps/garage/types-defaut"

chargerEnv({ path: ".env.local" })
chargerEnv()

const urlProprietaire = process.env.DATABASE_URL_MIGRATION
if (!urlProprietaire) {
  console.error("DATABASE_URL_MIGRATION absente : impossible de préparer les données de test.")
  process.exit(1)
}

const proprietaire = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlProprietaire }) })

const FICHIER_MIGRATION = path.join(process.cwd(), "prisma", "migrations", "20261021100000_garage_emplacements", "migration.sql")

class EcartEmplacements extends Error {}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartEmplacements(`${libelle}${detail ? ` (${detail})` : ""}`)
  console.log(`OK     ${libelle}`)
}

// Découpe le SQL en instructions : une instruction finit par « ; » en fin de ligne. Les lignes de commentaire sont retirées.
function instructions(sql: string): string[] {
  const sansCommentaires = sql
    .split(/\r?\n/)
    .filter((ligne) => !ligne.trimStart().startsWith("--"))
    .join("\n")
  return sansCommentaires
    .split(/;\s*\n/)
    .map((morceau) => morceau.trim().replace(/;$/, "").trim())
    .filter((morceau) => morceau.length > 0)
}

async function relancerMigration(): Promise<void> {
  const sql = readFileSync(FICHIER_MIGRATION, "utf8")
  for (const instruction of instructions(sql)) {
    await proprietaire.$executeRawUnsafe(instruction)
  }
}

type Organe = { position: string | null; deletedAt: Date | null; typeCle: string | null }

async function organesDe(teamId: string, vehicleId: string): Promise<Organe[]> {
  const lignes = await proprietaire.garageVehicleComponent.findMany({
    where: { teamId, vehicleId },
    include: { componentType: { select: { cle: true } } },
  })
  return lignes.map((l) => ({ position: l.position, deletedAt: l.deletedAt, typeCle: l.componentType.cle }))
}

// Positions actives d'un type sur une voiture, triées, pour comparer sans dépendre de l'ordre des lignes.
function positionsActives(organes: Organe[], cle: string): string[] {
  return organes
    .filter((o) => o.typeCle === cle && o.deletedAt === null)
    .map((o) => o.position ?? "(vide)")
    .sort()
}

const attendu: Record<string, string[]> = {
  moteur: ["unique"],
  boite: ["unique"],
  embrayage: ["unique"],
  transmissions: ["droite", "gauche"],
  freins: ["arriere_droit", "arriere_gauche", "avant_droit", "avant_gauche"],
  amortisseurs: ["arriere_droit", "arriere_gauche", "avant_droit", "avant_gauche"],
  pneus: ["train"],
}

async function main() {
  const suffixe = randomUUID().slice(0, 8)
  const team = { id: randomUUID(), nom: `Verif emplacements ${suffixe}`, slug: `verif-emplacements-${suffixe}` }
  const utilisateur = { id: randomUUID(), email: `verif-emplacements-${suffixe}@exemple.invalid` }
  const vehiculeVide = randomUUID()
  const vehiculeNul = randomUUID()
  const vehiculePositionne = randomUUID()
  const vehiculeConflit = randomUUID()
  const vehiculeRetire = randomUUID()
  const vehicules = [vehiculeVide, vehiculeNul, vehiculePositionne, vehiculeConflit, vehiculeRetire]

  try {
    await proprietaire.coreTeam.create({ data: { id: team.id, nom: team.nom, slug: team.slug } })
    await proprietaire.coreUser.create({ data: { id: utilisateur.id, email: utilisateur.email } })
    for (const id of vehicules) {
      await proprietaire.coreVehicle.create({ data: { id, teamId: team.id, type: "course", nomCourt: `Saxo ${id.slice(0, 4)}` } })
    }

    // Sept types par défaut, comme après team:creer et la première préparation.
    const types = new Map<string, string>()
    for (const type of TYPES_DEFAUT) {
      const id = randomUUID()
      types.set(type.cle, id)
      await proprietaire.garageComponentType.create({
        data: { id, teamId: team.id, cle: type.cle, nom: type.nom, icone: type.icone, critique: type.critique, ordre: type.ordre },
      })
    }

    const creerOrgane = (vehicleId: string, cle: string, position: string | null, retire = false) =>
      proprietaire.garageVehicleComponent.create({
        data: {
          id: randomUUID(),
          teamId: team.id,
          vehicleId,
          componentTypeId: types.get(cle)!,
          position,
          modeUsure: "les_deux",
          deletedAt: retire ? new Date() : null,
        },
      })

    // Voiture 2 : l'état de team-test-lot-2, sept organes sans position.
    for (const type of TYPES_DEFAUT) await creerOrgane(vehiculeNul, type.cle, null)

    // Voiture 3 : déjà positionnée (moteur unique, freins avant droit seul, pneus sans position).
    await creerOrgane(vehiculePositionne, "moteur", "unique")
    await creerOrgane(vehiculePositionne, "freins", "avant_droit")
    await creerOrgane(vehiculePositionne, "pneus", null)

    // Voiture 4 : conflit. Freins sans position, mais avant gauche déjà pris : la ligne sans position reste telle quelle.
    await creerOrgane(vehiculeConflit, "freins", null)
    await creerOrgane(vehiculeConflit, "freins", "avant_gauche")

    // Voiture 5 : le moteur sans position a été retiré. La migration ne le recrée pas.
    await creerOrgane(vehiculeRetire, "moteur", null, true)
    await creerOrgane(vehiculeRetire, "boite", null)

    // Voiture 1 : aucun organe. La migration n'en crée pas.

    // Première application, puis seconde : la migration doit être idempotente.
    await relancerMigration()
    const apresPremiere = await Promise.all(vehicules.map((id) => organesDe(team.id, id)))
    await relancerMigration()
    const apresSeconde = await Promise.all(vehicules.map((id) => organesDe(team.id, id)))

    const [vide, nul, positionne, conflit, retire] = apresPremiere

    controle("voiture sans organe : rien n'est créé", vide.length === 0, `${vide.length}`)

    controle("voiture à sept organes sans position : quatorze emplacements, aucune position vide", nul.length === 14 && nul.every((o) => o.position !== null), `${nul.length}`)
    for (const [cle, positions] of Object.entries(attendu)) {
      controle(`voiture à sept organes : ${cle} a ses emplacements`, JSON.stringify(positionsActives(nul, cle)) === JSON.stringify(positions), positionsActives(nul, cle).join(", "))
    }

    controle("voiture déjà positionnée : le moteur reste un seul organe", positionsActives(positionne, "moteur").length === 1)
    controle("voiture déjà positionnée : freins complétés sans doublon", JSON.stringify(positionsActives(positionne, "freins")) === JSON.stringify(attendu.freins), positionsActives(positionne, "freins").join(", "))
    controle("voiture déjà positionnée : pneus sans position reçoivent le train", positionsActives(positionne, "pneus").join(",") === "train")

    const freinsConflit = positionsActives(conflit, "freins")
    controle("voiture en conflit : le freins sans position reste sans position", freinsConflit.includes("(vide)"), freinsConflit.join(", "))
    controle("voiture en conflit : avant gauche n'est pas doublé", freinsConflit.filter((p) => p === "avant_gauche").length === 1, freinsConflit.join(", "))

    controle("voiture avec moteur retiré : le moteur n'est pas recréé", positionsActives(retire, "moteur").length === 0, positionsActives(retire, "moteur").join(", "))
    controle("voiture avec boîte sans position : la boîte reçoit son unique emplacement", positionsActives(retire, "boite").join(",") === "unique")

    controle("seconde application : aucune ligne ajoutée", JSON.stringify(apresSeconde.map((l) => l.length)) === JSON.stringify(apresPremiere.map((l) => l.length)), apresSeconde.map((l) => l.length).join(", "))
    controle("seconde application : mêmes positions", JSON.stringify(apresSeconde.map((l) => l.map((o) => o.position).sort())) === JSON.stringify(apresPremiere.map((l) => l.map((o) => o.position).sort())))
  } finally {
    await proprietaire.garageVehicleComponent.deleteMany({ where: { teamId: team.id } })
    await proprietaire.garageComponentType.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreUser.deleteMany({ where: { email: utilisateur.email } })
    await proprietaire.coreTeam.deleteMany({ where: { id: team.id } })
    await proprietaire.$disconnect()
  }
}

main()
  .then(() => {
    console.log("\nEmplacements vérifiés : la migration est juste et idempotente sur les cinq états.")
    process.exit(0)
  })
  .catch((erreur) => {
    console.error(`\n${erreur instanceof Error ? erreur.message : erreur}`)
    process.exit(1)
  })
