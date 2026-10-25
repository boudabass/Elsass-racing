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
  const pneus = await import("../src/apps/garage/pneus-serveur")
  const { executerPourTeam } = await import("../src/lib/prisma")

  const suffixe = randomUUID().slice(0, 8)
  const team = { id: randomUUID(), nom: `Verif garage ${suffixe}`, slug: `verif-garage-${suffixe}` }
  const utilisateur = { id: randomUUID(), email: `verif-garage-${suffixe}@exemple.invalid` }
  const adhesion = randomUUID()
  const vehicule = randomUUID()
  const ctx = { teamId: team.id, userId: utilisateur.id, membership: { id: adhesion, role: "responsable" as const } }
  // Seconde team, sans types ni organes : sert à la course à l'initialisation (types copiés et organes créés à deux).
  const equipe2 = { id: randomUUID(), nom: `Verif garage ${suffixe} B`, slug: `verif-garage-${suffixe}-b` }
  const vehicule2 = randomUUID()
  const equipes = [team.id, equipe2.id]

  try {
    await proprietaire.coreTeam.create({ data: { id: team.id, nom: team.nom, slug: team.slug } })
    await proprietaire.coreUser.create({ data: { id: utilisateur.id, email: utilisateur.email } })
    await proprietaire.coreMembership.create({
      data: { id: adhesion, teamId: team.id, userId: utilisateur.id, role: "responsable", statut: "actif" },
    })
    await proprietaire.coreVehicle.create({
      data: { id: vehicule, teamId: team.id, type: "course", nomCourt: `Saxo ${suffixe}` },
    })
    // Garage émet, Budget écoute (garage.piece_achetee) : les deux apps activées, pour que la proposition soit faite (section 11).
    await proprietaire.coreTeamApp.createMany({
      data: ["budget", "garage"].map((appCle, index) => ({
        id: randomUUID(),
        teamId: team.id,
        appCle,
        activee: true,
        versionInstallee: "0.1.0",
        ordre: index + 1,
      })),
    })

    // 1. Initialisation : sept types par défaut, un organe par emplacement (quatorze), sans doublon à la deuxième écriture.
    await executerPourTeam(team.id, utilisateur.id, (tx) => services.initialiserGarageDans(tx, ctx, vehicule))
    const types = await proprietaire.garageComponentType.findMany({ where: { teamId: team.id }, select: { id: true, cle: true } })
    controle("sept types d'organes par défaut copiés dans la team", types.length === 7, `${types.length}`)
    const organes = await proprietaire.garageVehicleComponent.findMany({ where: { teamId: team.id, vehicleId: vehicule } })
    controle("un organe par emplacement par défaut pour le véhicule (quatorze)", organes.length === 14, `${organes.length}`)
    await executerPourTeam(team.id, utilisateur.id, (tx) => services.initialiserGarageDans(tx, ctx, vehicule))
    const organesApres = await proprietaire.garageVehicleComponent.count({ where: { teamId: team.id, vehicleId: vehicule } })
    controle("une seconde initialisation ne double rien", organesApres === 14, `${organesApres}`)

    // 1 ter. Pièces d'origine (954 v1.2, « Voiture équipée dès le départ ») : une pièce montée par emplacement, un train
    // monté sur les pneus, une seule fois malgré la seconde initialisation. Puis le moteur est déposé pour les étapes
    // suivantes, qui testent la pose sur un organe libre.
    const piecesOrigine = await proprietaire.garagePart.findMany({ where: { teamId: team.id, vehicleId: vehicule, designation: "D'origine" } })
    controle("une pièce d'origine par emplacement sauf le train (treize)", piecesOrigine.length === 13, `${piecesOrigine.length}`)
    controle("chaque pièce d'origine est montée", piecesOrigine.every((p) => p.statut === "montee"))
    const trainOrigine = await proprietaire.garageTyreSet.findMany({ where: { teamId: team.id, vehicleId: vehicule, marque: "D'origine" } })
    controle("un train d'origine, monté sur l'organe pneus", trainOrigine.length === 1 && trainOrigine[0].type === "asphalte" && trainOrigine[0].statut === "neuf" && trainOrigine[0].usureEstimeePct === null)
    const monteSurPneus = await proprietaire.garageVehicleComponent.findFirst({ where: { teamId: team.id, vehicleId: vehicule, componentType: { cle: "pneus" } } })
    controle("le train d'origine est sur l'organe pneus", trainOrigine[0]?.vehicleComponentId === monteSurPneus?.id)
    const poseMoteur = await proprietaire.garagePartMount.findFirst({ where: { teamId: team.id, vehicleComponentId: organes.find((o) => o.componentTypeId === types.find((t) => t.cle === "moteur")!.id)!.id, deposeeLe: null } })
    controle("le moteur a sa pièce d'origine montée", poseMoteur !== null)
    await services.deposerPieceDans(ctx, poseMoteur!.id, "preventif", "reserve")

    // 1 bis. Course (correction E) : deux initialisations simultanées sur une team neuve et un véhicule neuf.
    // Les types sont copiés une seule fois et chaque emplacement n'a qu'un organe, sans erreur de clé étrangère.
    await proprietaire.coreTeam.create({ data: { id: equipe2.id, nom: equipe2.nom, slug: equipe2.slug } })
    await proprietaire.coreVehicle.create({
      data: { id: vehicule2, teamId: equipe2.id, type: "course", nomCourt: `Saxo B ${suffixe}` },
    })
    const ctx2 = { teamId: equipe2.id, userId: utilisateur.id, membership: { id: adhesion, role: "responsable" as const } }
    await Promise.all([1, 2].map(() => executerPourTeam(equipe2.id, utilisateur.id, (tx) => services.initialiserGarageDans(tx, ctx2, vehicule2))))
    const typesCourse = await proprietaire.garageComponentType.count({ where: { teamId: equipe2.id } })
    controle("deux initialisations simultanées copient sept types, pas plus", typesCourse === 7, `${typesCourse}`)
    const organesCourse = await proprietaire.garageVehicleComponent.count({ where: { teamId: equipe2.id, vehicleId: vehicule2 } })
    controle("deux initialisations simultanées donnent un organe par emplacement, sans doublon", organesCourse === 14, `${organesCourse}`)
    const piecesCourse = await proprietaire.garagePart.count({ where: { teamId: equipe2.id, vehicleId: vehicule2 } })
    const trainsCourse = await proprietaire.garageTyreSet.count({ where: { teamId: equipe2.id, vehicleId: vehicule2 } })
    controle("deux initialisations simultanées ne doublent pas les pièces d'origine", piecesCourse === 13 && trainsCourse === 1, `${piecesCourse} pièces, ${trainsCourse} train`)

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
    const refusSansDestination = await refuse(services.poserPieceDans(ctx, organeDe("moteur"), piece2, { motifDepose: "usure" }))
    controle("une pose sur un organe occupé exige ce que devient l'ancienne pièce", refusSansDestination?.includes("ce que devient") === true, refusSansDestination ?? "aucun refus")
    const refusDejaMontee = await refuse(services.poserPieceDans(ctx, organeDe("moteur"), piece1, { motifDepose: "usure", destinationAncienne: "reserve" }))
    controle("une pièce déjà montée ne se pose pas une seconde fois", refusDejaMontee?.includes("déjà montée") === true, refusDejaMontee ?? "aucun refus")

    // 4. Pose avec motif et destination : la pièce en place va en réserve (statut « en stock ») et garde son motif ; la nouvelle est montée.
    await services.poserPieceDans(ctx, organeDe("moteur"), piece2, { motifDepose: "usure", destinationAncienne: "reserve" })
    const ancienne = await proprietaire.garagePart.findUnique({ where: { id: piece1 } })
    const nouvelle = await proprietaire.garagePart.findUnique({ where: { id: piece2 } })
    controle("la pièce déposée va en réserve : statut « en stock », quel que soit le motif", ancienne?.statut === "en_stock", ancienne?.statut)
    const motifDeLaPose = await proprietaire.garagePartMount.findFirst({ where: { partId: piece1, deposeeLe: { not: null } } })
    controle("le motif de la dépose reste enregistré sur la pose", motifDeLaPose?.motifDepose === "usure", `${motifDeLaPose?.motifDepose}`)
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

    // 6. Train de pneus monté sur l'organe Pneus : l'usure manuelle compte une épreuve sur le train. Le train d'origine
    // est démonté d'abord, pour que le seul train monté soit celui du test.
    await proprietaire.garageTyreSet.updateMany({ where: { teamId: team.id, vehicleId: vehicule, marque: "D'origine" }, data: { vehicleComponentId: null } })
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

    // 9. Course (correction F) : deux validations simultanées du même engagement ne comptent qu'une fois.
    // Chaque cible reçoit une seule ligne d'usure, et ses cumuls progressent d'une seule fois.
    const saison = await proprietaire.coreSeason.create({
      data: { id: randomUUID(), teamId: team.id, annee: 2026, nom: `Saison ${suffixe}`, dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-12-31") },
    })
    const evenement = await proprietaire.coreEvent.create({
      data: {
        id: randomUUID(),
        teamId: team.id,
        seasonId: saison.id,
        type: "rallye",
        nom: `Rallye ${suffixe}`,
        dateDebut: new Date("2026-06-01"),
        dateFin: new Date("2026-06-02"),
      },
    })
    const engagement = randomUUID()
    await proprietaire.coreEventEntry.create({ data: { id: engagement, teamId: team.id, eventId: evenement.id, vehicleId: vehicule } })
    const avantPiece = await proprietaire.garagePart.findUniqueOrThrow({ where: { id: piece2 } })
    const avantTrain = await proprietaire.garageTyreSet.findUniqueOrThrow({ where: { id: train.id } })
    // Cibles montées au moment de la validation, avec les mêmes critères que ciblesUsure : une ligne d'usure par cible.
    const nombreCibles =
      (await proprietaire.garagePartMount.count({ where: { teamId: team.id, deposeeLe: null, deletedAt: null, vehicleComponent: { vehicleId: vehicule } } })) +
      (await proprietaire.garageTyreSet.count({ where: { teamId: team.id, vehicleId: vehicule, vehicleComponentId: { not: null }, deletedAt: null } }))

    await Promise.all([1, 2].map(() => services.appliquerUsureResultatDans(ctx, engagement, evenement.id, 40)))
    const apresPiece = await proprietaire.garagePart.findUniqueOrThrow({ where: { id: piece2 } })
    const apresTrain = await proprietaire.garageTyreSet.findUniqueOrThrow({ where: { id: train.id } })
    const lignesCourse = await proprietaire.garageWearLog.count({ where: { eventEntryId: engagement } })
    controle("le véhicule a des cibles d'usure montées", nombreCibles > 0, `${nombreCibles}`)
    controle("deux validations simultanées donnent une ligne par cible", lignesCourse === nombreCibles, `${lignesCourse} lignes pour ${nombreCibles} cibles`)
    controle(
      "les km de la validation ne sont comptés qu'une fois sur la pièce",
      Number(apresPiece.kmCumules) - Number(avantPiece.kmCumules) === 40,
      `${Number(apresPiece.kmCumules) - Number(avantPiece.kmCumules)}`,
    )
    controle(
      "l'épreuve de la validation n'est comptée qu'une fois sur la pièce",
      apresPiece.epreuvesCumulees - avantPiece.epreuvesCumulees === 1,
      `${apresPiece.epreuvesCumulees - avantPiece.epreuvesCumulees}`,
    )
    controle(
      "les km de la validation ne sont comptés qu'une fois sur le train",
      Number(apresTrain.kmSpeciale) - Number(avantTrain.kmSpeciale) === 40,
      `${Number(apresTrain.kmSpeciale) - Number(avantTrain.kmSpeciale)}`,
    )
    controle(
      "l'épreuve de la validation n'est comptée qu'une fois sur le train",
      apresTrain.nombreEpreuves - avantTrain.nombreEpreuves === 1,
      `${apresTrain.nombreEpreuves - avantTrain.nombreEpreuves}`,
    )

    // Un troisième traitement, séquentiel, ne compte plus rien.
    await services.appliquerUsureResultatDans(ctx, engagement, evenement.id, 40)
    const relecturePiece = await proprietaire.garagePart.findUniqueOrThrow({ where: { id: piece2 } })
    const lignesApres = await proprietaire.garageWearLog.count({ where: { eventEntryId: engagement } })
    controle("un traitement de plus, après coup, n'ajoute ni ligne ni km", lignesApres === nombreCibles && Number(relecturePiece.kmCumules) === Number(apresPiece.kmCumules), `${lignesApres}`)

    // 10. Réparation (954 v1.3, §4) : la clôture saisit l'état de la pièce montée, puis l'usure qui suit le fait baisser.
    // La préparation pose une pièce sur chaque emplacement : on dépose une pièce (préventif), puis une pièce de 1 000 km
    // est posée à sa place, en mode km. L'organe a donc bien une pièce montée au moment de la clôture ; l'état part de 80 %.
    const pose = await proprietaire.garagePartMount.findFirst({
      where: { teamId: team.id, deposeeLe: null, deletedAt: null, vehicleComponent: { vehicleId: vehicule, componentType: { cle: { not: "pneus" } } } },
      select: { id: true, vehicleComponentId: true, vehicleComponent: { select: { componentTypeId: true } } },
    })
    controle("une pièce montée peut être déposée pour la réparation", pose !== null)
    await services.deposerPieceDans(ctx, pose!.id, "preventif", "reserve")
    const organeLibre = { id: pose!.vehicleComponentId, componentTypeId: pose!.vehicleComponent.componentTypeId }
    await services.modifierOrganeDans(ctx, organeLibre.id, { modeUsure: "km" })
    const pieceReparee = await services.creerPieceDans(ctx, vehicule, { componentTypeId: organeLibre.componentTypeId, designation: "Pièce réparée", dureeVieKm: 1000 })
    await services.poserPieceDans(ctx, organeLibre.id, pieceReparee)

    const ordreReparation = await services.reparerOrganeDans(ctx, organeLibre.id, { titre: "Réparation d'essai" })
    const refusSansEtat = await refuse(services.terminerOrdreDans(ctx, ordreReparation, {}, "ecriture"))
    controle("terminer une réparation sans état saisi est refusé", refusSansEtat?.includes("état") === true, refusSansEtat ?? "aucun refus")
    const refusHorsBornes = await refuse(services.terminerOrdreDans(ctx, ordreReparation, { etatApresPct: 101 }, "ecriture"))
    controle("un état saisi au-delà de 100 % est refusé", refusHorsBornes?.includes("état") === true, refusHorsBornes ?? "aucun refus")
    const ordreApresRefus = await proprietaire.garageWorkOrder.findUniqueOrThrow({ where: { id: ordreReparation } })
    controle("un refus de clôture ne termine pas l'ordre", ordreApresRefus.statut === "prevu", ordreApresRefus.statut)

    await services.terminerOrdreDans(ctx, ordreReparation, { etatApresPct: 80 }, "ecriture")
    const saisies = await proprietaire.garagePartEtat.findMany({ where: { workOrderId: ordreReparation } })
    controle(
      "la clôture écrit une saisie, pour la pièce montée, dans la team",
      saisies.length === 1 && saisies[0].partId === pieceReparee && saisies[0].etatPct === 80 && saisies[0].teamId === team.id,
      `${saisies.length} lignes`,
    )
    const etatSaisi = await executerPourTeam(team.id, utilisateur.id, (tx) => services.etatsDuVehicule(tx, team.id, vehicule))
    controle("l'état de la pièce repart de la saisie : 80 %", etatSaisi.pieces.get(pieceReparee)?.etat === 80, `${etatSaisi.pieces.get(pieceReparee)?.etat}`)

    await services.ajouterUsureManuelleDans(ctx, vehicule, { km: 100, epreuve: false })
    const etatUsure = await executerPourTeam(team.id, utilisateur.id, (tx) => services.etatsDuVehicule(tx, team.id, vehicule))
    controle("l'usure qui suit fait baisser l'état saisi : 80 % moins 100 km sur 1 000 km, soit 70 %", etatUsure.pieces.get(pieceReparee)?.etat === 70, `${etatUsure.pieces.get(pieceReparee)?.etat}`)

    const vueAutreTeam = await executerPourTeam(equipe2.id, utilisateur.id, (tx) => tx.garagePartEtat.count({ where: { workOrderId: ordreReparation } }))
    controle("une autre team ne voit pas la saisie (RLS)", vueAutreTeam === 0, `${vueAutreTeam}`)
    const refusAutreTeam = await refuse(
      services.terminerOrdreDans({ teamId: equipe2.id, userId: utilisateur.id, membership: ctx.membership }, ordreReparation, { etatApresPct: 50 }, "ecriture"),
    )
    controle("une autre team ne clôt pas la réparation d'une équipe voisine", refusAutreTeam?.includes("introuvable") === true, refusAutreTeam ?? "aucun refus")

    const etatHorsBornes = await refuse(
      proprietaire.garagePartEtat.create({ data: { id: randomUUID(), teamId: team.id, partId: pieceReparee, workOrderId: ordreReparation, etatPct: 101 } }),
    )
    controle("la base refuse un état hors de 0 à 100", etatHorsBornes !== null, "insertion acceptée")

    // 11. Remplacer avec prix (954 v1.2, §2 ; Budget, option A). Un prix passe par une commande reçue tout de suite : la pièce
    // reçue est celle qui se pose, un seul garage.piece_achetee part, et Budget en fait une proposition à confirmer. Un refus
    // (fournisseur absent) n'écrit rien ; un remplacement sans prix ne crée ni commande, ni événement, ni proposition.
    const organeFreins = organeDe("freins")
    if ((await proprietaire.garagePartMount.count({ where: { vehicleComponentId: organeFreins, deposeeLe: null, deletedAt: null } })) === 0) {
      const depart = await services.creerPieceDans(ctx, vehicule, { componentTypeId: typeDe("freins"), designation: "Disque de départ" })
      await services.poserPieceDans(ctx, organeFreins, depart)
    }
    const enPlaceAvant = await proprietaire.garagePartMount.findFirstOrThrow({ where: { vehicleComponentId: organeFreins, deposeeLe: null, deletedAt: null } })
    const fournisseur = randomUUID()
    await proprietaire.coreContact.create({ data: { id: fournisseur, teamId: team.id, nom: `Fournisseur ${suffixe}` } })

    const comptes = async () => ({
      achats: await proprietaire.garagePurchase.count({ where: { teamId: team.id } }),
      evenements: await proprietaire.coreDomainEvent.count({ where: { teamId: team.id, nom: "garage.piece_achetee" } }),
      propositions: await proprietaire.budgetSuggestion.count({ where: { teamId: team.id, deletedAt: null } }),
      pieces: await proprietaire.garagePart.count({ where: { teamId: team.id } }),
      poses: await proprietaire.garagePartMount.count({ where: { teamId: team.id } }),
    })
    const avantRefus = await comptes()
    const refusSansFournisseur = await refuse(
      services.poserNouvellePieceDans(ctx, organeFreins, { designation: "Disque avant", prixCents: 4500 }, { motifDepose: "usure", destinationAncienne: "reserve" }),
    )
    controle("un remplacement avec prix sans fournisseur est refusé, avec sa raison", refusSansFournisseur?.includes("fournisseur") === true, refusSansFournisseur ?? "aucun refus")
    controle("ce refus n'écrit rien en base", JSON.stringify(await comptes()) === JSON.stringify(avantRefus), JSON.stringify(await comptes()))

    const pieceRecue = await services.poserNouvellePieceDans(
      ctx,
      organeFreins,
      { designation: "Disque avant", marque: "Brembo", prixCents: 4500, fournisseurContactId: fournisseur },
      { motifDepose: "usure", destinationAncienne: "reserve" },
    )
    const commande = await proprietaire.garagePurchase.findFirstOrThrow({ where: { teamId: team.id, supplierContactId: fournisseur } })
    controle("la commande du remplacement est reçue tout de suite", commande.statut === "recue", commande.statut)
    const lignes = await proprietaire.garagePurchaseLine.findMany({ where: { purchaseId: commande.id } })
    controle("une seule ligne, une unité, au prix saisi", lignes.length === 1 && lignes[0].quantite === 1 && lignes[0].prixUnitaireCents === 4500, JSON.stringify(lignes.map((l) => [l.quantite, l.prixUnitaireCents])))
    const reçue = await proprietaire.garagePart.findUniqueOrThrow({ where: { id: pieceRecue } })
    controle("la pièce créée par la réception est celle qui se pose", reçue.commandeLigneId === lignes[0].id, `${reçue.commandeLigneId}`)
    const posee = await proprietaire.garagePartMount.findFirstOrThrow({ where: { vehicleComponentId: organeFreins, deposeeLe: null, deletedAt: null } })
    controle("la pose active porte la pièce reçue", posee.partId === pieceRecue, `${posee.partId}`)
    const ancienneReserve = await proprietaire.garagePart.findUniqueOrThrow({ where: { id: enPlaceAvant.partId } })
    controle("l'ancienne pièce va en réserve : statut « en stock »", ancienneReserve.statut === "en_stock", ancienneReserve.statut)

    const evenementsCommande = (await proprietaire.coreDomainEvent.findMany({ where: { teamId: team.id, nom: "garage.piece_achetee" } })).filter(
      (evenement) => (evenement.donnees as { purchaseId?: string }).purchaseId === commande.id,
    )
    controle(
      "un seul garage.piece_achetee pour la commande, du bon montant",
      evenementsCommande.length === 1 && (evenementsCommande[0].donnees as { totalCents?: number }).totalCents === 4500,
      `${evenementsCommande.length} événement(s)`,
    )
    const propositions = await proprietaire.budgetSuggestion.findMany({ where: { teamId: team.id, origineRef: `garage_purchase:${commande.id}`, deletedAt: null } })
    controle(
      "Budget propose une seule dépense, du bon montant, en attente",
      propositions.length === 1 && propositions[0].montant === 4500 && propositions[0].statut === "en_attente",
      JSON.stringify(propositions.map((p) => [p.montant, p.statut])),
    )
    const action = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: propositions[0]?.actionCle ?? "" } })
    controle("la proposition a sa core_action à confirmer", action?.type === "mouvement_a_confirmer" && action.statut === "en_attente", `${action?.type} ${action?.statut}`)

    // Sans prix : rien de plus côté achats, événements ou Budget. La pièce posée est la nouvelle, l'ancienne (reçue) part au rebut.
    const avantSansPrix = await comptes()
    const sansPrix = await services.poserNouvellePieceDans(ctx, organeFreins, { designation: "Disque arrière" }, { motifDepose: "casse", destinationAncienne: "rebut" })
    const apresSansPrix = await comptes()
    controle(
      "un remplacement sans prix ne crée ni commande, ni événement, ni proposition",
      apresSansPrix.achats === avantSansPrix.achats && apresSansPrix.evenements === avantSansPrix.evenements && apresSansPrix.propositions === avantSansPrix.propositions,
      JSON.stringify([avantSansPrix, apresSansPrix]),
    )
    const poseeSansPrix = await proprietaire.garagePartMount.findFirstOrThrow({ where: { vehicleComponentId: organeFreins, deposeeLe: null, deletedAt: null } })
    controle("la pièce sans prix est posée", poseeSansPrix.partId === sansPrix, `${poseeSansPrix.partId}`)
    const auRebut = await proprietaire.garagePart.findUniqueOrThrow({ where: { id: pieceRecue } })
    controle("la pièce reçue, déposée au rebut, passe à « cassée »", auRebut.statut === "cassee", auRebut.statut)

    // 12. Intervention rapide avec pièce (954 v1.2, §2 ; décision de l'orchestrateur) : une pose sur un organe occupé exige la
    // destination de l'ancienne pièce. Sans elle, refus avec sa raison, et rien n'est écrit. Avec « rebut », l'ancienne passe à « cassée ».
    // Le compte a sa fiche personne : sans elle, l'intervention est refusée (comme pour le responsable d'une vraie team).
    await proprietaire.corePerson.create({ data: { id: randomUUID(), teamId: team.id, nom: "Verif", prenom: `Garage ${suffixe}`, userId: utilisateur.id } })
    const titreIntervention = `Intervention verif ${suffixe}`
    const pieceIntervention = await services.creerPieceDans(ctx, vehicule, { componentTypeId: typeDe("freins"), designation: "Plaquette d'intervention" })
    const occupeAvantIntervention = await proprietaire.garagePartMount.findFirstOrThrow({ where: { vehicleComponentId: organeFreins, deposeeLe: null, deletedAt: null } })
    const refusIntervention = await refuse(
      services.creerInterventionDans(ctx, vehicule, { vehicleComponentId: organeFreins, titre: titreIntervention, partId: pieceIntervention, motifDepose: "usure" }),
    )
    controle(
      "une intervention avec pièce sur un organe occupé exige la destination de l'ancienne pièce",
      refusIntervention?.includes("ce que devient") === true,
      refusIntervention ?? "aucun refus",
    )
    const ordresRefuses = await proprietaire.garageWorkOrder.count({ where: { teamId: team.id, titre: titreIntervention } })
    const poseApresRefus = await proprietaire.garagePartMount.findFirstOrThrow({ where: { vehicleComponentId: organeFreins, deposeeLe: null, deletedAt: null } })
    controle("ce refus n'écrit ni ordre, ni pose", ordresRefuses === 0 && poseApresRefus.id === occupeAvantIntervention.id, `${ordresRefuses} ordre(s)`)

    await services.creerInterventionDans(ctx, vehicule, {
      vehicleComponentId: organeFreins,
      titre: titreIntervention,
      partId: pieceIntervention,
      motifDepose: "casse",
      destinationAncienne: "rebut",
    })
    const ordreIntervention = await proprietaire.garageWorkOrder.findFirstOrThrow({ where: { teamId: team.id, titre: titreIntervention } })
    controle(
      "l'intervention avec pièce est un remplacement terminé",
      ordreIntervention.type === "remplacement" && ordreIntervention.statut === "termine",
      `${ordreIntervention.type} ${ordreIntervention.statut}`,
    )
    const poseIntervention = await proprietaire.garagePartMount.findFirstOrThrow({ where: { vehicleComponentId: organeFreins, deposeeLe: null, deletedAt: null } })
    controle("la pièce de l'intervention est posée sur l'organe", poseIntervention.partId === pieceIntervention, `${poseIntervention.partId}`)
    const cassee = await proprietaire.garagePart.findUniqueOrThrow({ where: { id: occupeAvantIntervention.partId } })
    controle("l'ancienne pièce, déposée au rebut, passe à « cassée »", cassee.statut === "cassee", cassee.statut)

    // 13. Trains de pneus (tâche 4.4, brief §2 ; décision de l'orchestrateur du 24/10). Un train acheté avec un prix passe par
    // une commande reçue : un garage_tyre_set, aucune garage_part, un seul garage.piece_achetee, une proposition Budget. Une
    // ligne Pneus hors de l'écran Pneus, et une réception Pneus sans données de train, sont refusées sans rien écrire.
    const typePneus = typeDe("pneus")
    const organePneus = organeDe("pneus")
    const fournisseurPneus = randomUUID()
    await proprietaire.coreContact.create({ data: { id: fournisseurPneus, teamId: team.id, nom: `Pneumatiques ${suffixe}` } })
    const comptesPneus = async () => ({
      achats: await proprietaire.garagePurchase.count({ where: { teamId: team.id } }),
      trains: await proprietaire.garageTyreSet.count({ where: { teamId: team.id, deletedAt: null } }),
      piecesPneus: await proprietaire.garagePart.count({ where: { teamId: team.id, componentTypeId: typePneus } }),
      evenements: await proprietaire.coreDomainEvent.count({ where: { teamId: team.id, nom: "garage.piece_achetee" } }),
      propositions: await proprietaire.budgetSuggestion.count({ where: { teamId: team.id, deletedAt: null } }),
    })
    const ligneDePneus = { designation: "Pneu", componentTypeId: typePneus, quantite: 1, prixUnitaireCents: 5000, qualite: "origine" as const }
    const commandeDuJour = { supplierContactId: fournisseurPneus, commandeeLe: "2026-10-24", lignes: [ligneDePneus] }
    const messagePneus = "Un train de pneus s'achète depuis l'écran Pneus."

    // 13 a. Une ligne Pneus créée depuis Commandes est refusée, avec sa raison, sans rien écrire.
    const avantLigne = await comptesPneus()
    const refusLigne = await refuse(services.creerCommandeDans(ctx, vehicule, commandeDuJour))
    controle("une ligne Pneus créée depuis Commandes est refusée, avec sa raison", refusLigne === messagePneus, `${refusLigne}`)
    controle("ce refus n'écrit ni commande, ni train", JSON.stringify(await comptesPneus()) === JSON.stringify(avantLigne))

    // 13 b. Une réception Pneus sans données de train est refusée avant toute écriture : la commande reste expédiée.
    const commandeNue = await services.creerCommandeDans(ctx, vehicule, commandeDuJour, { achatTrain: true })
    await services.expedierCommandeDans(ctx, commandeNue)
    const avantNue = await comptesPneus()
    const refusNue = await refuse(services.recevoirCommandeDans(ctx, commandeNue))
    controle("une réception Pneus sans données de train est refusée, avec sa raison", refusNue === messagePneus, `${refusNue}`)
    const statutNue = await proprietaire.garagePurchase.findUniqueOrThrow({ where: { id: commandeNue } })
    controle(
      "la commande reste expédiée, et rien n'est créé à la réception refusée",
      statutNue.statut === "expediee" && JSON.stringify(await comptesPneus()) === JSON.stringify(avantNue),
      statutNue.statut,
    )

    // 13 c. Train avec prix : une commande reçue, un garage_tyre_set non monté, neuf, acheté à la date de réception, aucune
    // garage_part, un seul garage.piece_achetee du bon montant, et une proposition Budget à confirmer.
    const avantPrix = await comptesPneus()
    await pneus.ajouterTrainAcheteDans(ctx, vehicule, {
      train: { marque: "Michelin", modele: "Alpin", type: "pluie" },
      fournisseurContactId: fournisseurPneus,
      prixCents: 12000,
    })
    const apresPrix = await comptesPneus()
    controle(
      "un train acheté avec prix : une commande et un train, aucune pièce",
      apresPrix.achats === avantPrix.achats + 1 && apresPrix.trains === avantPrix.trains + 1 && apresPrix.piecesPneus === avantPrix.piecesPneus,
      JSON.stringify([avantPrix, apresPrix]),
    )
    const trainAchete = await proprietaire.garageTyreSet.findFirstOrThrow({ where: { teamId: team.id, marque: "Michelin" } })
    controle(
      "le train est non monté, neuf, de type pluie, acheté à la réception",
      trainAchete.vehicleComponentId === null && trainAchete.statut === "neuf" && trainAchete.type === "pluie" && trainAchete.acheteLe !== null,
      `${trainAchete.vehicleComponentId} ${trainAchete.statut} ${trainAchete.type}`,
    )
    // La commande reçue, pas celle de la section 13 b (refusée à la réception, restée expédiée).
    const achatPneus = await proprietaire.garagePurchaseLine.findFirstOrThrow({
      where: { teamId: team.id, componentTypeId: typePneus, purchase: { vehicleId: vehicule, statut: "recue" } },
    })
    const evenementsTrain = (await proprietaire.coreDomainEvent.findMany({ where: { teamId: team.id, nom: "garage.piece_achetee" } })).filter(
      (evenement) => (evenement.donnees as { purchaseId?: string }).purchaseId === achatPneus.purchaseId,
    )
    controle(
      "un seul garage.piece_achetee pour l'achat du train, du bon montant",
      evenementsTrain.length === 1 && (evenementsTrain[0].donnees as { totalCents?: number }).totalCents === 12000,
      `${evenementsTrain.length} événement(s)`,
    )
    const propositionTrain = await proprietaire.budgetSuggestion.findMany({
      where: { teamId: team.id, origineRef: `garage_purchase:${achatPneus.purchaseId}`, deletedAt: null },
    })
    controle(
      "Budget propose une dépense pour le train, en attente",
      propositionTrain.length === 1 && propositionTrain[0].montant === 12000 && propositionTrain[0].statut === "en_attente",
      JSON.stringify(propositionTrain.map((p) => [p.montant, p.statut])),
    )

    // 13 d. Sans prix : le train entre directement, sans commande, sans événement ni proposition.
    const avantSansPrixTrain = await comptesPneus()
    await pneus.ajouterTrainAcheteDans(ctx, vehicule, { train: { marque: "Continental", type: "terre" }, fournisseurContactId: null, prixCents: null })
    const apresSansPrixTrain = await comptesPneus()
    controle(
      "un train sans prix : un train, ni commande, ni événement, ni proposition",
      apresSansPrixTrain.trains === avantSansPrixTrain.trains + 1 &&
        apresSansPrixTrain.achats === avantSansPrixTrain.achats &&
        apresSansPrixTrain.evenements === avantSansPrixTrain.evenements &&
        apresSansPrixTrain.propositions === avantSansPrixTrain.propositions,
      JSON.stringify([avantSansPrixTrain, apresSansPrixTrain]),
    )

    // 13 e. Montage : un seul train monté par organe, le précédent démonté sans destination ; un montage déjà en place est refusé.
    const trainA = trainAchete.id
    const trainB = (await proprietaire.garageTyreSet.findFirstOrThrow({ where: { teamId: team.id, marque: "Continental" } })).id
    const trainC = randomUUID()
    await proprietaire.garageTyreSet.create({ data: { id: trainC, teamId: team.id, vehicleId: vehicule, marque: "Pirelli", type: "neige", statut: "neuf" } })
    await pneus.monterTrainDans(ctx, trainA, organePneus)
    await pneus.monterTrainDans(ctx, trainB, organePneus)
    const montesApres = await proprietaire.garageTyreSet.findMany({ where: { teamId: team.id, vehicleComponentId: organePneus, deletedAt: null } })
    controle("un seul train monté sur l'organe pneus, le dernier monté", montesApres.length === 1 && montesApres[0].id === trainB, `${montesApres.length}`)
    const demonte = await proprietaire.garageTyreSet.findUniqueOrThrow({ where: { id: trainA } })
    controle("le train démonté reste à la team, sans destination", demonte.vehicleComponentId === null && demonte.deletedAt === null)
    const refusDejaMonte = await refuse(pneus.monterTrainDans(ctx, trainB, organePneus))
    controle("monter un train déjà monté est refusé, avec sa raison", refusDejaMonte === "Ce train est déjà monté.", `${refusDejaMonte}`)

    // 13 f. Course : deux montages simultanés sur le même organe ne laissent qu'un train monté ; l'autre est refusé.
    const resultatsCourse = await Promise.allSettled([pneus.monterTrainDans(ctx, trainA, organePneus), pneus.monterTrainDans(ctx, trainC, organePneus)])
    const montesCourse = await proprietaire.garageTyreSet.count({ where: { teamId: team.id, vehicleComponentId: organePneus, deletedAt: null } })
    const erreursInattendues = resultatsCourse.filter((r) => r.status === "rejected" && !(r.reason instanceof services.ErreurGarage))
    controle("deux montages simultanés : un seul train monté", montesCourse === 1, `${montesCourse}`)
    controle("la course ne lève que des refus avec leur raison", erreursInattendues.length === 0, `${erreursInattendues.length}`)

    // 13 g. Usure et statut saisis à la main : hors de 0 à 100 refusé ; 42 % et « Utilisé » enregistrés.
    const refusUsure = await refuse(pneus.saisirUsureTrainDans(ctx, trainC, { usureEstimeePct: 150, statut: "utilise" }))
    controle("une usure de 150 % est refusée, avec sa raison", refusUsure === "L'usure estimée est un nombre entier de 0 à 100 %.", `${refusUsure}`)
    await pneus.saisirUsureTrainDans(ctx, trainC, { usureEstimeePct: 42, statut: "utilise" })
    const saisi = await proprietaire.garageTyreSet.findUniqueOrThrow({ where: { id: trainC } })
    controle("l'usure de 42 % et le statut « utilisé » sont enregistrés", saisi.usureEstimeePct === 42 && saisi.statut === "utilise", `${saisi.usureEstimeePct} ${saisi.statut}`)

    // 13 h. Index unique partiel : la base refuse un second train monté sur le même organe.
    const second = await refuse(
      proprietaire.garageTyreSet.create({ data: { id: randomUUID(), teamId: team.id, vehicleId: vehicule, vehicleComponentId: organePneus, marque: "Test", type: "terre", statut: "neuf" } }),
    )
    controle("la base refuse un second train monté sur le même organe", second !== null)

    // 13 i. Type de casse facultatif (option A) : une fiche casse sans type est acceptée, « à compléter ».
    const fiche = await proprietaire.garageIncident.create({ data: { id: randomUUID(), teamId: team.id, vehicleId: vehicule, date: new Date(), type: null } })
    controle("une fiche casse sans type est acceptée par la base (à compléter)", fiche.type === null)

    // 14. Fiches casse (tâche 4.4, brief §3 ; 954 §1, §3, §5). Un abandon déclaré dans Saison ouvre une fiche à compléter,
    // une seule par engagement. Les services de la fiche refusent ce qui n'est pas valable, avec leur raison.
    const socle = await import("../src/core/evenements/gestionnaires")
    await import("../src/apps/garage/liaisons-serveur")
    const casses = await import("../src/apps/garage/casses-serveur")
    const recuType = { id: randomUUID(), nom: "saison.abandon_declare", version: 1, appEmettrice: "saison", donnees: {} }
    const gestionnaire = socle.trouverGestionnaire("garage", "saison.abandon_declare") as
      | ((c: typeof ctx, e: typeof recuType) => Promise<void>)
      | undefined
    controle("le gestionnaire saison.abandon_declare est enregistré côté Garage", gestionnaire !== undefined)
    const speciale = randomUUID()
    await proprietaire.saisonStage.create({
      data: { id: speciale, teamId: team.id, eventId: evenement.id, numero: 1, nom: `Spéciale ${suffixe}`, type: "speciale" },
    })
    const abandon = { entryId: engagement, eventId: evenement.id, causeAbandon: "Casse de cardan", stageAbandonId: speciale }
    await gestionnaire!(ctx, { ...recuType, donnees: abandon })
    await gestionnaire!(ctx, { ...recuType, id: randomUUID(), donnees: abandon })
    const fichesAbandon = await proprietaire.garageIncident.findMany({ where: { eventEntryId: engagement } })
    controle("un abandon, traité deux fois, ouvre une seule fiche", fichesAbandon.length === 1, `${fichesAbandon.length} fiche(s)`)
    const ficheAbandon = fichesAbandon[0]
    controle(
      "la fiche reprend véhicule, épreuve, date de l'épreuve, spéciale et cause, et reste à compléter",
      ficheAbandon.vehicleId === vehicule &&
        ficheAbandon.eventId === evenement.id &&
        ficheAbandon.date.getTime() === new Date("2026-06-01").getTime() &&
        ficheAbandon.specialeNom === `Spéciale ${suffixe}` &&
        ficheAbandon.stageId === speciale &&
        ficheAbandon.cause === "Casse de cardan" &&
        ficheAbandon.type === null,
      JSON.stringify(ficheAbandon),
    )
    const engagementInconnu = await refuse(gestionnaire!(ctx, { ...recuType, donnees: { ...abandon, entryId: randomUUID() } }))
    controle("un engagement introuvable ne crée ni fiche ni erreur", engagementInconnu === null, engagementInconnu ?? "")
    // Un engagement supprimé n'est plus lisible : rien ne s'ouvre, sans erreur. (Un engagement sans véhicule ne peut pas
    // exister : core_event_entry.vehicle_id est obligatoire.)
    const engagementSupprime = randomUUID()
    await proprietaire.coreEventEntry.create({ data: { id: engagementSupprime, teamId: team.id, eventId: evenement.id, vehicleId: vehicule, deletedAt: new Date() } })
    const refusSupprime = await refuse(gestionnaire!(ctx, { ...recuType, donnees: { ...abandon, entryId: engagementSupprime } }))
    const fichesSupprime = await proprietaire.garageIncident.count({ where: { eventEntryId: engagementSupprime } })
    controle("un engagement supprimé ne crée ni fiche ni erreur", refusSupprime === null && fichesSupprime === 0, `${fichesSupprime} fiche(s) ; ${refusSupprime ?? ""}`)

    // Création à la main : voiture, date et cause (nettoyée) ; une date inexistante est refusée avec sa raison.
    const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const dateInvalide = await refuse(casses.creerFicheCasseDans(ctx, { vehicleId: vehicule, date: "2026-02-30", eventId: null, cause: null }))
    controle("une date qui n'existe pas est refusée avec sa raison", dateInvalide === "Indique la date de la casse.", dateInvalide ?? "acceptée")
    const voitureInconnue = await refuse(casses.creerFicheCasseDans(ctx, { vehicleId: randomUUID(), date: demain, eventId: null, cause: null }))
    controle("une voiture hors de la team est refusée", voitureInconnue === "Cette voiture n'existe pas dans la team.", voitureInconnue ?? "")
    const ficheMain = await casses.creerFicheCasseDans(ctx, { vehicleId: vehicule, date: demain, eventId: null, cause: "  Sortie dans un virage  " })
    const creee = await proprietaire.garageIncident.findUniqueOrThrow({ where: { id: ficheMain } })
    controle("une fiche à la main garde voiture et cause nettoyée, sans type ni engagement", creee.vehicleId === vehicule && creee.type === null && creee.cause === "Sortie dans un virage" && creee.eventEntryId === null)

    // Complétion : un type hors liste, un organe étranger, une pièce non montée à la date de la casse, puis un cas valable.
    const montage = await proprietaire.garagePartMount.findFirst({
      where: { teamId: team.id, deposeeLe: null, deletedAt: null, part: { vehicleId: vehicule } },
      select: { partId: true, vehicleComponentId: true },
    })
    if (!montage) throw new EcartGarage("aucune pièce montée sur la voiture pour la complétion de casse")
    const typeInvalide = await refuse(casses.completerFicheCasseDans(ctx, ficheMain, { type: "inconnue", cause: null, organesIds: [], piecesIds: [] }))
    controle("un type hors liste est refusé avec sa raison", typeInvalide === "Choisis le type de casse.", typeInvalide ?? "accepté")
    const organeEtranger = await refuse(
      casses.completerFicheCasseDans(ctx, ficheMain, { type: "accident", cause: null, organesIds: [randomUUID()], piecesIds: [] }),
    )
    controle("un organe qui n'est pas sur la voiture est refusé", organeEtranger === "Un organe touché n'appartient pas à cette voiture.", organeEtranger ?? "accepté")
    const pieceAvantPose = await refuse(
      casses.completerFicheCasseDans(ctx, ficheAbandon.id, {
        type: "casse_mecanique",
        cause: null,
        organesIds: [montage.vehicleComponentId],
        piecesIds: [montage.partId],
      }),
    )
    controle(
      "une pièce posée après la casse est refusée avec sa raison",
      pieceAvantPose === "Une pièce cassée n'était pas montée sur ces organes à la date de la casse.",
      pieceAvantPose ?? "acceptée",
    )
    await casses.completerFicheCasseDans(ctx, ficheMain, {
      type: "accident",
      cause: "Choc contre un rocher",
      organesIds: [montage.vehicleComponentId],
      piecesIds: [montage.partId],
    })
    const complete = await proprietaire.garageIncident.findUniqueOrThrow({ where: { id: ficheMain } })
    controle("la fiche complétée garde le type et la cause saisis", complete.type === "accident" && complete.cause === "Choc contre un rocher")
    const liens = await proprietaire.garageIncidentComponent.count({ where: { incidentId: ficheMain, deletedAt: null } })
    const piecesLiees = await proprietaire.garageIncidentPart.count({ where: { incidentId: ficheMain, deletedAt: null } })
    controle("l'organe touché et la pièce cassée sont liés à la fiche", liens === 1 && piecesLiees === 1, `${liens} organe(s), ${piecesLiees} pièce(s)`)
    // Retrait puis rétablissement d'un organe : le lien est supprimé logiquement, puis réactivé sans doublon.
    await casses.completerFicheCasseDans(ctx, ficheMain, { type: "accident", cause: "Choc contre un rocher", organesIds: [], piecesIds: [] })
    const liensRetires = await proprietaire.garageIncidentComponent.count({ where: { incidentId: ficheMain, deletedAt: null } })
    const lignesLiens = await proprietaire.garageIncidentComponent.count({ where: { incidentId: ficheMain } })
    controle("un organe retiré n'est plus lié, sans être effacé", liensRetires === 0 && lignesLiens === 1, `${liensRetires} actif(s), ${lignesLiens} ligne(s)`)
    await casses.completerFicheCasseDans(ctx, ficheMain, {
      type: "accident",
      cause: "Choc contre un rocher",
      organesIds: [montage.vehicleComponentId],
      piecesIds: [montage.partId],
    })
    const lignesRetablies = await proprietaire.garageIncidentComponent.count({ where: { incidentId: ficheMain } })
    controle("l'organe rétabli se réactive sans doublon", lignesRetablies === 1, `${lignesRetablies} ligne(s)`)

    // Réparation liée (954 §3) : seulement sur un organe touché, un ordre par fiche, lu avec la fiche.
    const organeNonTouche = await refuse(casses.ouvrirReparationCasseDans(ctx, ficheMain, randomUUID()))
    controle("une réparation ne s'ouvre que sur un organe touché", organeNonTouche === "Cet organe n'est pas touché par cette casse.", organeNonTouche ?? "acceptée")
    const reparation = await casses.ouvrirReparationCasseDans(ctx, ficheMain, montage.vehicleComponentId)
    const ordre = await proprietaire.garageWorkOrder.findUniqueOrThrow({ where: { id: reparation } })
    const ficheLiee = await proprietaire.garageIncident.findUniqueOrThrow({ where: { id: ficheMain } })
    controle(
      "la réparation est un ordre de réparation sur l'organe touché, titré « Casse », et la fiche la retient",
      ordre.type === "reparation" && ordre.vehicleComponentId === montage.vehicleComponentId && ordre.titre === "Casse" && ficheLiee.reparationWorkOrderId === reparation,
      `${ordre.type} ${ordre.titre}`,
    )
    const deuxieme = await refuse(casses.ouvrirReparationCasseDans(ctx, ficheMain, montage.vehicleComponentId))
    controle("une fiche n'a qu'une réparation liée", deuxieme === "Cette fiche a déjà une réparation liée.", deuxieme ?? "acceptée")

    // Cloisonnement : une autre team ne voit pas la fiche.
    const vueFicheAutreTeam = await executerPourTeam(equipe2.id, utilisateur.id, (tx) => tx.garageIncident.count({ where: { id: ficheMain } }))
    controle("une autre team ne voit pas la fiche casse", vueFicheAutreTeam === 0, `${vueFicheAutreTeam} vue(s)`)
    const liensAutreTeam = await executerPourTeam(equipe2.id, utilisateur.id, (tx) => tx.garageIncidentComponent.count({ where: { incidentId: ficheMain } }))
    const piecesAutreTeam = await executerPourTeam(equipe2.id, utilisateur.id, (tx) => tx.garageIncidentPart.count({ where: { incidentId: ficheMain } }))
    controle(
      "une autre team ne voit ni les organes touchés ni les pièces cassées de la fiche (RLS)",
      liensAutreTeam === 0 && piecesAutreTeam === 0,
      `${liensAutreTeam} organe(s), ${piecesAutreTeam} pièce(s)`,
    )

    // 15. Plan avant épreuve (tâche 4.5, brief §2 et §5 ; 954 v1.4 §2). Constat seul : un ordre prévu avant l'épreuve
    // engagée est compté ; un ordre d'une autre épreuve et un ordre terminé ne le sont pas. Hors niveau écriture, aucun
    // coût n'est renvoyé. Les lectures partagées sont closes pour une autre team.
    const partagees = await import("../src/apps/garage/lectures-partagees")
    const saisonPartagee = await import("../src/apps/saison/lectures-partagees")
    const epreuveAutre = await proprietaire.coreEvent.create({
      data: { id: randomUUID(), teamId: team.id, seasonId: saison.id, type: "rallye", nom: `Autre ${suffixe}`, dateDebut: new Date("2026-07-01"), dateFin: new Date("2026-07-02") },
    })
    const organePlan = await proprietaire.garageVehicleComponent.findFirstOrThrow({ where: { teamId: team.id, vehicleId: vehicule, deletedAt: null } })
    const ordrePrevu = await services.creerOrdreDans(ctx, vehicule, {
      type: "reparation",
      titre: "Avant épreuve",
      vehicleComponentId: organePlan.id,
      aFaireAvantEventId: evenement.id,
      dureeEstimeeMinutes: 60,
    })
    await services.modifierCoutOrdreDans(ctx, ordrePrevu, { coutMainOeuvreCents: 5000, prestataireContactId: null })
    await services.creerOrdreDans(ctx, vehicule, {
      type: "reparation",
      titre: "Autre épreuve",
      vehicleComponentId: organePlan.id,
      aFaireAvantEventId: epreuveAutre.id,
      dureeEstimeeMinutes: 30,
    })
    const ordreTermine = await services.creerOrdreDans(ctx, vehicule, {
      type: "reparation",
      titre: "Déjà fait",
      vehicleComponentId: organePlan.id,
      aFaireAvantEventId: evenement.id,
      dureeEstimeeMinutes: 15,
    })
    await proprietaire.garageWorkOrder.update({ where: { id: ordreTermine }, data: { statut: "termine" } })

    const engagementsVehicule = await saisonPartagee.lireEngagementsAVenir(ctx, vehicule)
    controle("la lecture des engagements à venir voit l'engagement de la voiture", engagementsVehicule.some((e) => e.entryId === engagement))
    const plan = await partagees.lirePlanAvantEpreuve(ctx, vehicule, null, false)
    const ordresPlan = plan ? [...plan.lignes.flatMap((ligne) => ligne.ordres), ...plan.ordresSansOrgane] : []
    controle("le plan prend la prochaine épreuve engagée de la voiture", plan?.epreuve?.eventId === evenement.id, plan?.epreuve?.eventId ?? "aucune")
    controle(
      "le plan ne compte que l'ordre prévu avant cette épreuve (ni autre épreuve, ni ordre terminé)",
      ordresPlan.length === 1 && ordresPlan[0].id === ordrePrevu,
      `${ordresPlan.length} ordre(s)`,
    )
    controle(
      "hors niveau écriture, le plan ne renvoie aucun coût",
      plan?.coutCents === null && ordresPlan.every((ordre) => ordre.coutMainOeuvreCents === null),
      `${plan?.coutCents}`,
    )
    const planAvecPrix = await partagees.lirePlanAvantEpreuve(ctx, vehicule, null, true)
    controle(
      "au niveau écriture, le plan somme la durée et le coût des ordres prévus",
      planAvecPrix?.coutCents === 5000 && planAvecPrix.dureeMinutes === 60,
      `${planAvecPrix?.coutCents} centimes, ${planAvecPrix?.dureeMinutes} min`,
    )
    const planAutreTeam = await partagees.lirePlanAvantEpreuve({ teamId: equipe2.id, userId: utilisateur.id, membership: ctx.membership }, vehicule, null, true)
    controle("une autre team ne voit pas le plan de la voiture (RLS)", planAutreTeam === null)
    const engagementsAutreTeam = await saisonPartagee.lireEngagementsAVenir({ teamId: equipe2.id, userId: utilisateur.id, membership: ctx.membership }, vehicule)
    controle("une autre team ne voit pas les engagements à venir de la voiture (RLS)", engagementsAutreTeam.length === 0, `${engagementsAutreTeam.length}`)

    // 16. Équipements de la team (tâche 4.6, brief §3 et §4 ; 954 v1.4 §2). Création, modification (rev qui avance), retrait
    // doux, refus avec raison ; la valeur n'est servie qu'au niveau écriture ; RLS entre deux teams.
    const equipementsServeur = await import("../src/apps/garage/equipements-serveur")
    const lecturesEquipements = await import("../src/apps/garage/lectures-equipements-serveur")
    const remorque = await equipementsServeur.creerEquipementDans(ctx, {
      nom: "Remorque de test",
      categorie: "remorque",
      etat: "bon",
      acheteLe: "2024-03-01",
      valeur: "2 500",
      prochainControleLe: "2026-10-20",
      emplacement: "Parc",
    })
    const equipementCree = await proprietaire.garageEquipment.findUnique({ where: { id: remorque } })
    controle(
      "création : l'équipement est en base, avec sa valeur en centimes et son contrôle en date civile",
      equipementCree?.valeurCents === 250000 && equipementCree?.prochainControleLe?.toISOString().slice(0, 10) === "2026-10-20" && equipementCree?.rev === 1,
      `${equipementCree?.valeurCents} ${equipementCree?.prochainControleLe?.toISOString()}`,
    )
    const refusNom = await refuse(equipementsServeur.creerEquipementDans(ctx, { nom: "  ", categorie: "remorque", valeur: null }))
    controle("un équipement sans nom est refusé avec sa raison", refusNom === "Indique le nom de l'équipement.", `${refusNom}`)
    const refusNegatif = await refuse(equipementsServeur.creerEquipementDans(ctx, { nom: "Négatif", categorie: "levage", valeur: "-10" }))
    controle("une valeur négative est refusée avec sa raison", refusNegatif?.includes("positif") === true, `${refusNegatif}`)

    await equipementsServeur.modifierEquipementDans(ctx, remorque, {
      nom: "Remorque de test 2",
      categorie: "remorque",
      etat: "",
      acheteLe: "",
      valeur: "2 000",
      prochainControleLe: "",
      emplacement: "Atelier",
    })
    const modifiee = await proprietaire.garageEquipment.findUnique({ where: { id: remorque } })
    controle(
      "modification : le nom et la valeur changent, les champs vides redeviennent vides, rev avance",
      modifiee?.nom === "Remorque de test 2" && modifiee?.valeurCents === 200000 && modifiee?.etat === null && modifiee?.prochainControleLe === null && modifiee?.rev === 2,
      `${modifiee?.nom} ${modifiee?.valeurCents} rev ${modifiee?.rev}`,
    )

    const compresseur = await equipementsServeur.creerEquipementDans(ctx, { nom: "Compresseur de test", categorie: "outillage", valeur: "350" })
    await equipementsServeur.retirerEquipementDans(ctx, remorque)
    const retiree = await proprietaire.garageEquipment.findUnique({ where: { id: remorque } })
    controle("retrait : suppression douce, rev avance, la ligne reste en base", retiree?.deletedAt !== null && retiree?.rev === 3, `rev ${retiree?.rev}`)
    const refusRetrait = await refuse(equipementsServeur.retirerEquipementDans(ctx, remorque))
    controle("un équipement déjà retiré ne se retire pas une seconde fois", refusRetrait?.includes("n'existe pas") === true, `${refusRetrait}`)

    const liste = await lecturesEquipements.lireEquipementsDans(ctx, true)
    controle(
      "la liste (niveau écriture) exclut l'équipement retiré et sert la valeur",
      liste.length === 1 && liste[0].id === compresseur && liste[0].valeurCents === 35000,
      `${liste.length} ligne(s)`,
    )
    const listeSansValeur = await lecturesEquipements.lireEquipementsDans(ctx, false)
    controle(
      "hors niveau écriture, la lecture ne sert aucune valeur (assistance)",
      listeSansValeur.length === 1 && listeSansValeur.every((ligne) => ligne.valeurCents === null),
      `${listeSansValeur.length} ligne(s)`,
    )
    const equipementsAutreTeam = await lecturesEquipements.lireEquipementsDans({ teamId: equipe2.id, userId: utilisateur.id, membership: ctx.membership }, true)
    controle("une autre team ne voit pas les équipements (RLS)", equipementsAutreTeam.length === 0, `${equipementsAutreTeam.length}`)
  } finally {
    // Nettoyage avec le rôle propriétaire, dans l'ordre des clés étrangères, pour les deux teams. Budget et les actions
    // d'abord : ils ne dépendent pas des tables du Garage.
    await proprietaire.budgetReimbursementLine.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.budgetReimbursement.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.budgetSuggestion.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.budgetForecast.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.budgetIncome.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.budgetExpense.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.budgetPayer.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.budgetCategory.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAction.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageWearLog.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garagePartMount.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garagePartEtat.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageWorkOrderPart.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageWorkOrderPerson.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageWorkOrder.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageIncidentComponent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageIncidentPart.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageIncident.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageTyreSet.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garagePart.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageEquipment.deleteMany({ where: { teamId: { in: equipes } } })
    // Achats : les lignes d'abord (elles tiennent la commande), puis les commandes, puis le fournisseur qu'elles citent.
    await proprietaire.garagePurchaseLine.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garagePurchase.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreContact.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageVehicleComponent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageComponentType.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEventEntry.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.saisonStage.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreSeason.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEventDelivery.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAppAccess.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.corePerson.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreUser.deleteMany({ where: { email: { endsWith: `-${suffixe}@exemple.invalid` } } })
    await proprietaire.coreTeamApp.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreTeam.deleteMany({ where: { id: { in: equipes } } })
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
