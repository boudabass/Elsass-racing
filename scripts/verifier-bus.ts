// Vérifie le bus d'événements et la boîte d'actions contre la base réelle.
// Usage : pnpm db:verifier-bus
//
// La team de test et son responsable sont créés avec le rôle propriétaire, puis les
// fonctions réelles (emettre, decider) sont appelées avec le rôle applicatif. Tout est
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

class EcartBus extends Error {}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartBus(`${libelle}${detail ? ` (${detail})` : ""}`)
  console.log(`OK     ${libelle}`)
}

async function main() {
  // Import dynamique : .env.local doit être chargé avant la création du client applicatif.
  const { emettre, ErreurEvenement } = await import("../src/core/evenements/bus-serveur")
  const { decider } = await import("../src/core/actions/actions-serveur")
  const { prisma: applicatif } = await import("../src/lib/prisma")

  const suffixe = randomUUID().slice(0, 8)
  const team = { id: randomUUID(), nom: `Verif bus ${suffixe}`, slug: `verif-bus-${suffixe}` }
  const utilisateur = { id: randomUUID(), email: `verif-bus-${suffixe}@exemple.invalid` }
  const adhesion = randomUUID()
  const CLES_APPS = ["saison", "budget", "partenaires", "voiture", "garage", "equipe", "checklist", "documents", "medias", "dashboard", "settings"]

  try {
    await proprietaire.coreTeam.create({ data: { id: team.id, nom: team.nom, slug: team.slug } })
    await proprietaire.coreUser.create({ data: { id: utilisateur.id, email: utilisateur.email } })
    await proprietaire.coreMembership.create({
      data: { id: adhesion, teamId: team.id, userId: utilisateur.id, role: "responsable", statut: "actif" },
    })
    await proprietaire.coreTeamApp.createMany({
      data: CLES_APPS.map((appCle, index) => ({
        id: randomUUID(),
        teamId: team.id,
        appCle,
        activee: true,
        versionInstallee: "0.1.0",
        ordre: index + 1,
      })),
    })

    const ctx = { teamId: team.id, userId: utilisateur.id, membership: { id: adhesion, role: "responsable" as const } }

    // 1. Un événement d'app vers un abonné explicite : livré, sans gestionnaire, marqué traité.
    const idPaye = await emettre(ctx, "saison.engagement_paye", { demo: true })
    const livraisonsPaye = await proprietaire.coreEventDelivery.findMany({ where: { domainEventId: idPaye } })
    controle(
      "saison.engagement_paye livre une seule fois, à budget",
      livraisonsPaye.length === 1 && livraisonsPaye[0].appDestinataire === "budget",
      `livraisons : ${livraisonsPaye.length}`,
    )
    controle(
      "la livraison est traitée, sans gestionnaire",
      livraisonsPaye[0]?.statut === "traite" && livraisonsPaye[0]?.derniereErreur === "aucun gestionnaire",
      `statut : ${livraisonsPaye[0]?.statut}`,
    )

    // 2. Un nom hors catalogue est refusé.
    let refuse = false
    try {
      await emettre(ctx, "saison.nom_invente", {})
    } catch (erreur) {
      refuse = erreur instanceof ErreurEvenement
    }
    controle("un nom hors catalogue est refusé (ErreurEvenement)", refuse)

    // 3. « * » : une livraison par app activée, sauf l'émetteur.
    const idExport = await emettre(ctx, "settings.export_demande", {})
    const nbExport = await proprietaire.coreEventDelivery.count({ where: { domainEventId: idExport } })
    controle(
      "settings.export_demande : une livraison par app activée, sauf settings",
      nbExport === CLES_APPS.length - 1,
      `livraisons : ${nbExport}`,
    )

    // 4. Une action requise crée une ligne dans la boîte d'actions.
    const cleA = `verif-${suffixe}-a`
    const donneesA = {
      type: "verif",
      cleUnicite: cleA,
      titre: "Titre initial",
      destinataires: { roles: ["responsable"] },
      boutons: [{ cle: "ok", libelle: "OK" }],
      priorite: 3,
    }
    await emettre(ctx, "saison.action_requise", donneesA)
    const actionsA = await proprietaire.coreAction.findMany({ where: { teamId: team.id, cleUnicite: cleA } })
    controle("saison.action_requise crée une action en attente", actionsA.length === 1 && actionsA[0].statut === "en_attente")
    controle("l'action garde l'app d'origine saison", actionsA[0]?.appOrigine === "saison")

    // 5. Réémettre la même cleUnicite met à jour, sans doublon.
    await emettre(ctx, "saison.action_requise", { ...donneesA, titre: "Titre mis à jour" })
    const actionsA2 = await proprietaire.coreAction.findMany({ where: { teamId: team.id, cleUnicite: cleA } })
    controle("réémettre la même action ne crée pas de doublon", actionsA2.length === 1)
    controle("la réémission met le titre à jour", actionsA2[0]?.titre === "Titre mis à jour", actionsA2[0]?.titre)

    // 6. La décision passe l'action à decidee et émet core.action_decidee vers l'app d'origine.
    await decider(ctx, actionsA2[0].id, "ok")
    const actionDecidee = await proprietaire.coreAction.findUnique({ where: { id: actionsA2[0].id } })
    controle("decider passe l'action à decidee", actionDecidee?.statut === "decidee" && actionDecidee?.decision === "ok")
    const nbDecidee = await proprietaire.coreEventDelivery.count({
      where: { teamId: team.id, appDestinataire: "saison", domainEvent: { nom: "core.action_decidee" } },
    })
    controle("core.action_decidee est livré à l'app d'origine (saison), une seule fois", nbDecidee === 1, `livraisons : ${nbDecidee}`)

    // 7. Une action levée passe à annulee.
    const cleY = `verif-${suffixe}-y`
    await emettre(ctx, "saison.action_requise", { ...donneesA, cleUnicite: cleY, titre: "À lever" })
    await emettre(ctx, "saison.action_levee", { cleUnicite: cleY })
    const actionY = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: cleY } })
    controle("saison.action_levee passe l'action en annulee", actionY?.statut === "annulee", actionY?.statut)

    // 8. Le client applicatif voit bien l'action de la team de test.
    const vueParApp = await applicatif.coreAction.count({ where: { id: actionsA2[0].id } })
    controle("l'app ne voit pas l'action hors contexte de team", vueParApp === 0)

    // 9. Saison : création d'un engagement, puis paiement. Chaque événement n'est livré qu'à ses destinataires.
    const { creerEngagementDans, enregistrerPaiementDans } = await import("../src/apps/saison/services-serveur")
    const saisonBus = randomUUID()
    await proprietaire.coreSeason.create({
      data: { id: saisonBus, teamId: team.id, annee: 2030, nom: "Saison bus", dateDebut: new Date("2030-01-01"), dateFin: new Date("2030-12-31"), enCours: true },
    })
    // Date lointaine : l'engagement reste « payé », jamais « parti », quel que soit le jour du test.
    const epreuveBus = await proprietaire.coreEvent.create({
      data: {
        id: randomUUID(),
        teamId: team.id,
        seasonId: saisonBus,
        type: "rallye",
        nom: "Rallye test bus",
        dateDebut: new Date("2030-06-01"),
        dateFin: new Date("2030-06-02"),
      },
    })
    const vehiculeBus = await proprietaire.coreVehicle.create({
      data: { id: randomUUID(), teamId: team.id, type: "course", nomCourt: "Véhicule test bus" },
    })

    const entryId = await creerEngagementDans(ctx, { eventId: epreuveBus.id, vehicleId: vehiculeBus.id })
    const evenementEngage = await proprietaire.coreDomainEvent.findFirst({
      where: { teamId: team.id, nom: "saison.engagement_cree" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    const livraisonsEngage = await proprietaire.coreEventDelivery.findMany({
      where: { domainEventId: evenementEngage?.id },
      select: { appDestinataire: true },
    })
    const destinatairesEngage = livraisonsEngage.map((livraison) => livraison.appDestinataire).sort().join(",")
    controle(
      "saison.engagement_cree est livré à checklist, equipe et garage, et à eux seuls",
      destinatairesEngage === "checklist,equipe,garage",
      destinatairesEngage,
    )

    const inscription = await proprietaire.saisonRegistration.findUnique({ where: { entryId } })
    const pointPaiement = await proprietaire.saisonReadiness.findFirst({ where: { entryId, point: "paiement" } })
    controle("l'engagement crée l'inscription et le point paiement ouvert", inscription !== null && pointPaiement?.statut === "ouvert")

    await enregistrerPaiementDans(ctx, entryId, { payeLe: "2030-05-01", mode: "virement", montant: 4500 })
    const evenementPaye = await proprietaire.coreDomainEvent.findFirst({
      where: { teamId: team.id, nom: "saison.engagement_paye" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    const livraisonsPaiement = await proprietaire.coreEventDelivery.findMany({
      where: { domainEventId: evenementPaye?.id },
      select: { appDestinataire: true },
    })
    const destinatairesPaye = livraisonsPaiement.map((livraison) => livraison.appDestinataire).sort().join(",")
    controle("saison.engagement_paye est livré à budget, et à budget seul", destinatairesPaye === "budget", destinatairesPaye)

    const pointApres = await proprietaire.saisonReadiness.findFirst({ where: { entryId, point: "paiement" } })
    controle("le paiement passe le point paiement à réglé", pointApres?.statut === "regle")
    const engagementPaye = await proprietaire.coreEventEntry.findUnique({ where: { id: entryId }, select: { statut: true } })
    controle("un engagement payé passe à paye", engagementPaye?.statut === "paye", engagementPaye?.statut)

    console.log("\nBus et boîte d'actions vérifiés : tous les contrôles passent.")
  } finally {
    // Nettoyage avec le rôle propriétaire, dans l'ordre des clés étrangères.
    await proprietaire.saisonReadiness.deleteMany({ where: { teamId: team.id } })
    await proprietaire.saisonRegistration.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreEventEntry.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreEvent.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreSeason.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreAction.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreTeamApp.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreMembership.deleteMany({ where: { id: adhesion } })
    await proprietaire.coreTeam.deleteMany({ where: { id: team.id } })
    await proprietaire.coreUser.deleteMany({ where: { id: utilisateur.id } })
    await proprietaire.$disconnect()
  }
}

main()
  .then(() => process.exit(0))
  .catch((erreur) => {
    if (erreur instanceof EcartBus) {
      console.error(`ECHEC  ${erreur.message}`)
    } else {
      console.error("ERREUR", erreur)
    }
    process.exit(1)
  })
