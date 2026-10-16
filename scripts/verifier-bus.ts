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
    const { decider } = await import("../src/core/actions/actions-serveur")
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
      select: { id: true, donnees: true },
    })
    const livraisonsPaiement = await proprietaire.coreEventDelivery.findMany({
      where: { domainEventId: evenementPaye?.id },
      select: { appDestinataire: true },
    })
    const destinatairesPaye = livraisonsPaiement.map((livraison) => livraison.appDestinataire).sort().join(",")
    controle("saison.engagement_paye est livré à budget, et à budget seul", destinatairesPaye === "budget", destinatairesPaye)
    const montantPayeEmis = (evenementPaye?.donnees as { montant_paye?: number } | null)?.montant_paye
    controle("saison.engagement_paye porte montant_paye (4500)", montantPayeEmis === 4500, String(montantPayeEmis))

    const pointApres = await proprietaire.saisonReadiness.findFirst({ where: { entryId, point: "paiement" } })
    controle("le paiement passe le point paiement à réglé", pointApres?.statut === "regle")
    const engagementPaye = await proprietaire.coreEventEntry.findUnique({ where: { id: entryId }, select: { statut: true } })
    controle("un engagement payé passe à paye", engagementPaye?.statut === "paye", engagementPaye?.statut)

    // 10. Résultat à valider : la demande ne va pas à l'auteur de la saisie ; sa décision est refusée ;
    //     la validation par un autre membre passe par la boîte d'actions (gestionnaire core.action_decidee).
    const { saisirResultatDans, validerResultatDans, ErreurSaison } = await import("../src/apps/saison/services-serveur")
    const utilisateurA = { id: randomUUID(), email: `verif-bus-a-${suffixe}@exemple.invalid` }
    const utilisateurB = { id: randomUUID(), email: `verif-bus-b-${suffixe}@exemple.invalid` }
    const adhesionA = randomUUID()
    const adhesionB = randomUUID()
    await proprietaire.coreUser.createMany({ data: [{ id: utilisateurA.id, email: utilisateurA.email }, { id: utilisateurB.id, email: utilisateurB.email }] })
    await proprietaire.coreMembership.createMany({
      data: [
        { id: adhesionA, teamId: team.id, userId: utilisateurA.id, role: "equipage", statut: "actif" },
        { id: adhesionB, teamId: team.id, userId: utilisateurB.id, role: "equipage", statut: "actif" },
      ],
    })
    await proprietaire.coreAppAccess.createMany({
      data: [
        { id: randomUUID(), teamId: team.id, membershipId: adhesionA, appCle: "saison", niveau: "ecriture" },
        { id: randomUUID(), teamId: team.id, membershipId: adhesionB, appCle: "saison", niveau: "ecriture" },
      ],
    })
    const ctxA = { teamId: team.id, userId: utilisateurA.id, membership: { id: adhesionA, role: "equipage" as const } }
    const ctxB = { teamId: team.id, userId: utilisateurB.id, membership: { id: adhesionB, role: "equipage" as const } }

    await saisirResultatDans(ctxA, entryId, { statutFinal: "arrivee", classementClasse: 2 })
    const actionResultat = await proprietaire.coreAction.findFirst({
      where: { teamId: team.id, cleUnicite: `resultat_a_valider:${entryId}` },
    })
    const destinatairesResultat = (actionResultat?.destinataires as { memberships?: string[] } | null)?.memberships ?? []
    controle("la demande de validation est créée en attente", actionResultat?.statut === "en_attente", actionResultat?.statut)
    controle("la demande ne va pas à l'auteur de la saisie", !destinatairesResultat.includes(adhesionA))
    controle(
      "la demande va au responsable et à l'autre membre d'équipage",
      destinatairesResultat.includes(adhesionB) && destinatairesResultat.includes(adhesion),
      destinatairesResultat.join(","),
    )

    let refusAuteur = ""
    try {
      await validerResultatDans(ctxA, entryId)
    } catch (erreur) {
      refusAuteur = erreur instanceof ErreurSaison ? erreur.message : String(erreur)
    }
    controle("l'auteur ne valide pas sa saisie (règle du service)", refusAuteur.includes("un autre membre doit le valider"), refusAuteur)

    if (!actionResultat) throw new EcartBus("action de validation absente")
    let refusDecision = false
    try {
      await decider(ctxA, actionResultat.id, "valider")
    } catch {
      refusDecision = true
    }
    controle("l'auteur ne peut pas décider la validation depuis la boîte d'actions", refusDecision)

    await decider(ctxB, actionResultat.id, "valider")
    const resultatValide = await proprietaire.saisonResult.findUnique({ where: { entryId }, select: { validation: true, validParMembershipId: true } })
    controle("la validation par l'autre membre passe par la boîte et valide le résultat", resultatValide?.validation === "valide")
    controle("le validateur est bien l'autre membre", resultatValide?.validParMembershipId === adhesionB)
    const actionApres = await proprietaire.coreAction.findUnique({ where: { id: actionResultat.id }, select: { statut: true } })
    controle("après la validation, l'action sort de la boîte (levée, plus en attente)", actionApres?.statut !== "en_attente", actionApres?.statut)


    // 10. Préparation : les signaux des autres apps posent les points de l'engagement à venir.
    const epreuveFutureBus = await proprietaire.coreEvent.create({
      data: { id: randomUUID(), teamId: team.id, seasonId: saisonBus, type: "rallye", nom: "Rallye préparation bus", dateDebut: new Date("2030-07-01"), dateFin: new Date("2030-07-02") },
    })
    const entryFuture = await creerEngagementDans(ctx, { eventId: epreuveFutureBus.id, vehicleId: vehiculeBus.id })
    await emettre(ctx, "voiture.papier_expire_bientot", { vehicleId: vehiculeBus.id, detail: "Carte grise à renouveler" })
    const pointPapiers = await proprietaire.saisonReadiness.findFirst({ where: { entryId: entryFuture, point: "papiers" } })
    controle("un papier qui expire pose le point « papiers » ouvert, avec son détail", pointPapiers?.statut === "ouvert" && pointPapiers.detail === "Carte grise à renouveler")
    await emettre(ctx, "voiture.papier_expire_bientot", { vehicleId: vehiculeBus.id, regle: true })
    const pointPapiersRegle = await proprietaire.saisonReadiness.findFirst({ where: { entryId: entryFuture, point: "papiers" } })
    controle("le même signal avec regle: true règle le point", pointPapiersRegle?.statut === "regle")
    await emettre(ctx, "garage.piece_zone_rouge", { vehicleId: vehiculeBus.id, detail: "Pièce en zone rouge" })
    const pointPieces = await proprietaire.saisonReadiness.findFirst({ where: { entryId: entryFuture, point: "pieces" } })
    controle("une pièce en zone rouge pose le point « pièces » ouvert", pointPieces?.statut === "ouvert")
    const autreVehicule = await proprietaire.coreVehicle.create({ data: { id: randomUUID(), teamId: team.id, type: "course", nomCourt: "Autre voiture bus" } })
    await emettre(ctx, "garage.piece_zone_rouge", { vehicleId: autreVehicule.id })
    const pointsNonVises = await proprietaire.saisonReadiness.count({ where: { entryId: entryFuture, point: "pieces", statut: "ouvert" } })
    controle("un signal pour une autre voiture ne touche pas cet engagement", pointsNonVises === 1)
    await emettre(ctx, "equipe.licence_expire_bientot", { detail: "Licence à renouveler" })
    const pointLicence = await proprietaire.saisonReadiness.findFirst({ where: { entryId: entryFuture, point: "licences" } })
    controle("une licence sans personne vise toute la team : point « licences » ouvert", pointLicence?.statut === "ouvert")

    // 11. Décision refusée par la règle : la clôture d'une saison déjà clôturée est refusée. L'action reste
    // en attente, avec le motif affiché dans la boîte (message_refus).
    const saisonClotureeBus = randomUUID()
    await proprietaire.coreSeason.create({
      data: { id: saisonClotureeBus, teamId: team.id, annee: 2031, nom: "Saison close bus", dateDebut: new Date("2031-01-01"), dateFin: new Date("2031-12-31"), enCours: false, clotureeAt: new Date() },
    })
    const cleRefus = `cloture_saison:${saisonClotureeBus}`
    await emettre(ctx, "saison.action_requise", {
      type: "cloture_saison_proposee",
      cleUnicite: cleRefus,
      titre: "Clôturer la saison (test de refus)",
      contexte: "Saison",
      ficheType: "saison",
      ficheId: saisonClotureeBus,
      destinataires: { memberships: [adhesion] },
      boutons: [{ cle: "cloturer", libelle: "Clôturer la saison" }],
      priorite: 7,
      niveauRequis: "gestion",
    })
    const actionRefus = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: cleRefus }, select: { id: true } })
    await decider(ctx, actionRefus!.id, "cloturer")
    const apresRefus = await proprietaire.coreAction.findUnique({ where: { id: actionRefus!.id }, select: { statut: true, messageRefus: true } })
    controle("une décision que la règle refuse laisse l'action en attente", apresRefus?.statut === "en_attente", apresRefus?.statut)
    controle("le motif du refus est gardé pour la boîte d'actions", apresRefus?.messageRefus === "Saison introuvable ou déjà clôturée.", apresRefus?.messageRefus ?? "")
    // 12. Relance de validation : une saisie de plus de 48 heures, toujours non validée, est relancée (priorité 6).
    const epreuveRelance = await proprietaire.coreEvent.create({
      data: { id: randomUUID(), teamId: team.id, seasonId: saisonBus, type: "rallye", nom: "Rallye relance bus", dateDebut: new Date("2030-08-01"), dateFin: new Date("2030-08-02"), statut: "terminee" },
    })
    const entreeRelance = await proprietaire.coreEventEntry.create({
      data: { id: randomUUID(), teamId: team.id, eventId: epreuveRelance.id, vehicleId: vehiculeBus.id, statut: "arrivee" },
    })
    await proprietaire.saisonResult.create({
      data: { id: randomUUID(), teamId: team.id, entryId: entreeRelance.id, statutFinal: "arrivee", validation: "saisi", createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    })
    const { recalculerDans } = await import("../src/apps/saison/services-serveur")
    await recalculerDans(ctx)
    const relance = await proprietaire.coreAction.findFirst({
      where: { teamId: team.id, cleUnicite: `resultat_a_valider:${entreeRelance.id}` },
      select: { priorite: true, titre: true, statut: true },
    })
    controle("une saisie de plus de 48 heures non validée est relancée à la priorité 6", relance?.priorite === 6 && (relance?.titre ?? "").startsWith("Relance"), JSON.stringify(relance))

    console.log("\nBus et boîte d'actions vérifiés : tous les contrôles passent.")
  } finally {
    // Nettoyage avec le rôle propriétaire, dans l'ordre des clés étrangères.
    await proprietaire.saisonResult.deleteMany({ where: { teamId: team.id } })
    await proprietaire.saisonReadiness.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreAppAccess.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreUser.deleteMany({ where: { email: { endsWith: `-${suffixe}@exemple.invalid` } } })
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
