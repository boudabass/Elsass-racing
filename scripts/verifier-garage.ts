// Vérifie les services du Garage contre la base réelle (tâche 4.1).
// Usage : pnpm db:verifier-garage
//
// La team de test, son responsable, un véhicule et leurs données sont créés avec le rôle propriétaire ; les
// services réels (initialisation, pose, dépose, usure, événements) sont appelés avec le rôle applicatif. Tout est
// supprimé dans un finally. Une ligne par contrôle ; exit 1 au premier écart.

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

class EcartGarage extends Error {}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartGarage(`${libelle}${detail ? ` (${detail})` : ""}`)
  console.log(`OK     ${libelle}`)
}

async function refuse(action: Promise<unknown>): Promise<string | null> {
  try {
    await action
    return null
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : String(erreur)
  }
}

async function main() {
  // Import dynamique : .env.local doit être chargé avant la création du client applicatif.
  const services = await import("../src/apps/garage/services-serveur")
  const { executerPourTeam } = await import("../src/lib/prisma")

  const suffixe = randomUUID().slice(0, 8)
  const team = { id: randomUUID(), nom: `Verif garage ${suffixe}`, slug: `verif-garage-${suffixe}` }
  const utilisateur = { id: randomUUID(), email: `verif-garage-${suffixe}@exemple.invalid` }
  const adhesion = randomUUID()
  const vehicule = randomUUID()
  const ctx = { teamId: team.id, userId: utilisateur.id, membership: { id: adhesion, role: "responsable" } }

  try {
    await proprietaire.coreTeam.create({ data: { id: team.id, nom: team.nom, slug: team.slug } })
    await proprietaire.coreUser.create({ data: { id: utilisateur.id, email: utilisateur.email } })
    await proprietaire.coreMembership.create({
      data: { id: adhesion, teamId: team.id, userId: utilisateur.id, role: "responsable", statut: "actif" },
    })
    await proprietaire.coreVehicle.create({
      data: { id: vehicule, teamId: team.id, type: "course", nomCourt: `Saxo ${suffixe}` },
    })

    // 1. Initialisation : sept types par défaut, un organe par type, sans doublon à la deuxième écriture.
    await executerPourTeam(team.id, utilisateur.id, (tx) => services.initialiserGarageDans(tx, ctx, vehicule))
    const types = await proprietaire.garageComponentType.findMany({ where: { teamId: team.id }, select: { id: true, cle: true } })
    controle("sept types d'organes par défaut copiés dans la team", types.length === 7, `${types.length}`)
    const organes = await proprietaire.garageVehicleComponent.findMany({ where: { teamId: team.id, vehicleId: vehicule } })
    controle("un organe par type par défaut pour le véhicule", organes.length === 7, `${organes.length}`)
    await executerPourTeam(team.id, utilisateur.id, (tx) => services.initialiserGarageDans(tx, ctx, vehicule))
    const organesApres = await proprietaire.garageVehicleComponent.count({ where: { teamId: team.id, vehicleId: vehicule } })
    controle("une seconde initialisation ne double rien", organesApres === 7, `${organesApres}`)

    const typeDe = (cle: string) => types.find((t) => t.cle === cle)!.id
    const organeDe = (cle: string) => organes.find((o) => o.componentTypeId === typeDe(cle))!.id

    // 2. Organe moteur en mode km, durée de référence 100 km ; pièce posée.
    await services.modifierOrganeDans(ctx, organeDe("moteur"), { modeUsure: "km", dureeVieReferenceKm: 100 })
    const piece1 = await services.creerPieceDans(ctx, vehicule, { componentTypeId: typeDe("moteur"), designation: "Moteur d'essai" })
    const piece2 = await services.creerPieceDans(ctx, vehicule, { componentTypeId: typeDe("moteur"), designation: "Moteur de rechange" })
    const pieceFreins = await services.creerPieceDans(ctx, vehicule, { componentTypeId: typeDe("freins"), designation: "Disque" })

    await services.poserPieceDans(ctx, organeDe("moteur"), piece1)
    const montee = await proprietaire.garagePart.findUnique({ where: { id: piece1 } })
    controle("une pièce posée passe au statut « montée »", montee?.statut === "montee", montee?.statut)

    // 3. Refus : mauvais type, pose sans motif sur un organe occupé, pièce déjà montée.
    const refusType = await refuse(services.poserPieceDans(ctx, organeDe("moteur"), pieceFreins))
    controle("une pièce d'un autre type d'organe est refusée", refusType?.includes("ne va pas sur ce type d'organe") === true, refusType ?? "aucun refus")
    const refusSansMotif = await refuse(services.poserPieceDans(ctx, organeDe("moteur"), piece2))
    controle("une pose sur un organe occupé exige le motif de la dépose", refusSansMotif?.includes("motif") === true, refusSansMotif ?? "aucun refus")
    const refusDejaMontee = await refuse(services.poserPieceDans(ctx, organeDe("moteur"), piece1, { motifDepose: "usure" }))
    controle("une pièce déjà montée ne se pose pas une seconde fois", refusDejaMontee?.includes("déjà montée") === true, refusDejaMontee ?? "aucun refus")

    // 4. Pose avec motif : la pièce en place passe à « usée », la nouvelle est montée.
    await services.poserPieceDans(ctx, organeDe("moteur"), piece2, { motifDepose: "usure" })
    const ancienne = await proprietaire.garagePart.findUnique({ where: { id: piece1 } })
    const nouvelle = await proprietaire.garagePart.findUnique({ where: { id: piece2 } })
    controle("la pièce déposée pour usure passe à « usée »", ancienne?.statut === "usee", ancienne?.statut)
    controle("la nouvelle pièce est montée", nouvelle?.statut === "montee", nouvelle?.statut)
    const poseActive = await proprietaire.garagePartMount.count({
      where: { vehicleComponentId: organeDe("moteur"), deposeeLe: null, deletedAt: null },
    })
    controle("une seule pose active par organe", poseActive === 1, `${poseActive}`)

    // 5. Usure manuelle : 91 km sur 100 km de durée font 9 % : la pièce passe en zone rouge, une fois.
    await services.ajouterUsureManuelleDans(ctx, vehicule, { km: 91, epreuve: false })
    const usee = await proprietaire.garagePart.findUnique({ where: { id: piece2 } })
    controle("les km de l'usure manuelle sont ajoutés aux cumuls", Number(usee?.kmCumules) === 91, `${usee?.kmCumules}`)
    const alertes = await proprietaire.coreDomainEvent.count({ where: { teamId: team.id, nom: "garage.piece_zone_rouge" } })
    controle("le franchissement du seuil rouge émet garage.piece_zone_rouge une fois", alertes === 1, `${alertes}`)
    await services.ajouterUsureManuelleDans(ctx, vehicule, { km: 1, epreuve: false })
    const alertesApres = await proprietaire.coreDomainEvent.count({ where: { teamId: team.id, nom: "garage.piece_zone_rouge" } })
    controle("une pièce déjà en zone rouge n'émet plus rien", alertesApres === 1, `${alertesApres}`)

    // 6. Train de pneus monté sur l'organe Pneus : l'usure manuelle compte une épreuve sur le train.
    const train = await proprietaire.garageTyreSet.create({
      data: {
        id: randomUUID(),
        teamId: team.id,
        vehicleId: vehicule,
        vehicleComponentId: organeDe("pneus"),
        marque: "Test",
        type: "asphalte",
        createdBy: utilisateur.id,
        updatedBy: utilisateur.id,
      },
    })
    await services.ajouterUsureManuelleDans(ctx, vehicule, { km: 0, epreuve: true })
    const trainApres = await proprietaire.garageTyreSet.findUnique({ where: { id: train.id } })
    controle("le train monté reçoit l'épreuve de l'usure manuelle", trainApres?.nombreEpreuves === 1, `${trainApres?.nombreEpreuves}`)
    const journalTrain = await proprietaire.garageWearLog.count({ where: { tyreSetId: train.id } })
    controle("le train a sa ligne d'usure, une seule", journalTrain === 1, `${journalTrain}`)

    // 7. Index uniques partiels : une seconde pose active sur le même organe ou la même pièce est refusée par la base.
    const doublon = await refuse(
      proprietaire.garagePartMount.create({
        data: {
          id: randomUUID(),
          teamId: team.id,
          partId: piece1,
          vehicleComponentId: organeDe("moteur"),
          poseLe: new Date(),
          createdBy: utilisateur.id,
          updatedBy: utilisateur.id,
        },
      }),
    )
    controle("la base refuse une seconde pose active sur un organe", doublon !== null, "insertion acceptée")

    // 8. Dépose sans motif, à la main : refusée par le CHECK de cohérence.
    const depose = await refuse(
      proprietaire.garagePartMount.updateMany({
        where: { partId: piece2, deposeeLe: null },
        data: { deposeeLe: new Date() },
      }),
    )
    controle("la base refuse une dépose sans motif", depose !== null, "dépose acceptée")
  } finally {
    // Nettoyage avec le rôle propriétaire, dans l'ordre des clés étrangères.
    await proprietaire.garageWearLog.deleteMany({ where: { teamId: team.id } })
    await proprietaire.garagePartMount.deleteMany({ where: { teamId: team.id } })
    await proprietaire.garageTyreSet.deleteMany({ where: { teamId: team.id } })
    await proprietaire.garagePart.deleteMany({ where: { teamId: team.id } })
    await proprietaire.garageVehicleComponent.deleteMany({ where: { teamId: team.id } })
    await proprietaire.garageComponentType.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreEventDelivery.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreUser.deleteMany({ where: { email: { endsWith: `-${suffixe}@exemple.invalid` } } })
    await proprietaire.coreTeam.deleteMany({ where: { id: team.id } })
    await proprietaire.$disconnect()
  }
}

main()
  .then(() => {
    console.log("\nGarage vérifié : tous les contrôles passent.")
    process.exit(0)
  })
  .catch((erreur) => {
    console.error(`\n${erreur instanceof Error ? erreur.message : erreur}`)
    process.exit(1)
  })
