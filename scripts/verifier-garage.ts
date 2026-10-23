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
    await proprietaire.garageWorkOrder.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageTyreSet.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garagePart.deleteMany({ where: { teamId: { in: equipes } } })
    // Achats : les lignes d'abord (elles tiennent la commande), puis les commandes, puis le fournisseur qu'elles citent.
    await proprietaire.garagePurchaseLine.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garagePurchase.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreContact.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageVehicleComponent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageComponentType.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEventEntry.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreSeason.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEventDelivery.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAppAccess.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: { in: equipes } } })
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
