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

    // 1. Un événement d'app vers un abonné explicite : livré, marqué traité, sans erreur.
    //    (Budget écoute saison.engagement_paye depuis la 2.7 ; une charge utile invalide est ignorée sans erreur.)
    const idPaye = await emettre(ctx, "saison.engagement_paye", { demo: true })
    const livraisonsPaye = await proprietaire.coreEventDelivery.findMany({ where: { domainEventId: idPaye } })
    controle(
      "saison.engagement_paye livre une seule fois, à budget",
      livraisonsPaye.length === 1 && livraisonsPaye[0].appDestinataire === "budget",
      `livraisons : ${livraisonsPaye.length}`,
    )
    controle(
      "la livraison est traitée, sans erreur",
      livraisonsPaye[0]?.statut === "traite" && livraisonsPaye[0]?.derniereErreur === null,
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

    // 13. Budget : initialisation, dépense et solde, prévisionnel franchi une seule fois, suggestion confirmée
    //     par la boîte d'actions, décision refusée remise en attente avec son motif, remboursement et niveau.
    const budget = await import("../src/apps/budget/services-serveur")
    const personneBus = randomUUID()
    await proprietaire.corePerson.create({ data: { id: personneBus, teamId: team.id, nom: "Bus", prenom: "Verif" } })
    await proprietaire.coreMembership.update({ where: { id: adhesion }, data: { personId: personneBus } })
    // Course à l'initialisation (layout et page, au premier accès) : la caisse existante est retirée en douceur,
    // puis deux initialisations en parallèle ne doivent laisser qu'une seule caisse active.
    await proprietaire.budgetPayer.updateMany({ where: { teamId: team.id, type: "caisse_team", deletedAt: null }, data: { deletedAt: new Date() } })
    await Promise.all([budget.initialiserBudgetDans(ctx), budget.initialiserBudgetDans(ctx)])
    const nbCaissesActives = await proprietaire.budgetPayer.count({ where: { teamId: team.id, type: "caisse_team", deletedAt: null } })
    controle("deux initialisations en parallèle laissent une seule caisse active", nbCaissesActives === 1, `${nbCaissesActives}`)
    await budget.initialiserBudgetDans(ctx)
    const categoriesBudget = await proprietaire.budgetCategory.findMany({ where: { teamId: team.id }, select: { id: true, sens: true, nom: true } })
    const nbDepense = categoriesBudget.filter((categorie) => categorie.sens === "depense").length
    const nbRecette = categoriesBudget.filter((categorie) => categorie.sens === "recette").length
    controle("l'initialisation crée quinze catégories de dépense et sept de recette", nbDepense === 15 && nbRecette === 7, `dépense ${nbDepense}, recette ${nbRecette}`)
    await budget.initialiserBudgetDans(ctx)
    const nbCategories2 = await proprietaire.budgetCategory.count({ where: { teamId: team.id } })
    controle("une seconde initialisation ne crée aucun doublon", nbCategories2 === categoriesBudget.length, `${nbCategories2}`)
    const payeurMoi = await proprietaire.budgetPayer.findFirst({ where: { teamId: team.id, personId: personneBus } })
    const nbCaisses = await proprietaire.budgetPayer.count({ where: { teamId: team.id, type: "caisse_team", deletedAt: null } })
    controle("le responsable a un payeur « membre » et la team une seule caisse", payeurMoi?.type === "membre" && nbCaisses === 1)

    const idCategorie = (nom: string): string => categoriesBudget.find((categorie) => categorie.nom === nom)?.id ?? ""
    const catEngagement = idCategorie("Engagement")
    const catPieces = idCategorie("Pièces")
    const epreuveBudget = randomUUID()
    await proprietaire.coreEvent.create({
      data: { id: epreuveBudget, teamId: team.id, seasonId: saisonBus, type: "rallye", nom: "Rallye budget bus", dateDebut: new Date("2030-09-01"), dateFin: new Date("2030-09-02"), statut: "envisagee" },
    })
    await proprietaire.budgetForecast.create({ data: { id: randomUUID(), teamId: team.id, seasonId: saisonBus, categoryId: catEngagement, montant: 100_000 } })
    const compter = (nom: string) => proprietaire.coreDomainEvent.count({ where: { teamId: team.id, nom } })

    // Une dépense saisie par le membre : confirmée d'office, à rembourser, rattachée à la saison de l'épreuve.
    const depense1 = await budget.creerDepenseDans(ctx, { montant: 120_000, categoryId: catEngagement, libelle: "Engagement test", eventId: epreuveBudget })
    const d1 = await proprietaire.budgetExpense.findUnique({ where: { id: depense1 } })
    controle(
      "une dépense saisie est confirmée d'office, à rembourser, et rattachée à la saison",
      d1?.confirmee === true && d1?.aRembourser === true && d1?.remboursement === "a_rembourser" && d1?.seasonId === saisonBus,
      JSON.stringify(d1),
    )
    controle(
      "la dépense émet depense_creee, depense_confirmee, solde_modifie et depassement une fois",
      (await compter("budget.depense_creee")) === 1 && (await compter("budget.depense_confirmee")) === 1 && (await compter("budget.solde_modifie")) === 1 && (await compter("budget.depassement_previsionnel")) === 1,
    )
    await budget.creerDepenseDans(ctx, { montant: 5_000, categoryId: catEngagement, libelle: "Engagement test 2", eventId: epreuveBudget })
    controle("le dépassement n'est émis qu'au franchissement, une seule fois", (await compter("budget.depassement_previsionnel")) === 1)

    // Niveau contribution : une dépense payée par la caisse est refusée ; celle qu'on paie soi-même passe.
    const caisse = await proprietaire.budgetPayer.findFirst({ where: { teamId: team.id, type: "caisse_team", deletedAt: null } })
    let refusCaisse = ""
    try {
      await budget.creerDepenseDans(ctx, { montant: 100, categoryId: catEngagement, libelle: "Caisse", payerId: caisse?.id ?? "" }, "contribution")
    } catch (erreur) {
      refusCaisse = erreur instanceof budget.ErreurBudget ? erreur.message : String(erreur)
    }
    controle("sans écriture, une dépense payée par la caisse est refusée", refusCaisse.startsWith("Tu ne peux saisir"), refusCaisse)
    await budget.creerDepenseDans(ctx, { montant: 100, categoryId: catEngagement, libelle: "Mon paiement", payerId: payeurMoi?.id ?? "" }, "contribution")
    controle("sans écriture, sa propre dépense passe", (await compter("budget.depense_creee")) === 3)

    // Suggestion confirmée par la boîte d'actions : la décision crée la dépense, avec son origine.
    const idSuggestion = await budget.proposerMouvementDans(ctx, {
      appOrigine: "garage",
      evenementOrigine: "garage.piece_achetee",
      sens: "depense",
      montant: 4_500,
      categoryId: catPieces,
      libelle: "Pièce proposée",
      eventId: epreuveBudget,
    })
    const actionSuggestion = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: `budget_suggestion:${idSuggestion}` } })
    controle("une suggestion crée une action « mouvement à confirmer » en attente", actionSuggestion?.statut === "en_attente" && actionSuggestion?.type === "mouvement_a_confirmer")
    await decider(ctx, actionSuggestion?.id ?? "", "confirmer")
    const suggestionConfirmee = await proprietaire.budgetSuggestion.findUnique({ where: { id: idSuggestion } })
    controle("la décision « confirmer » rend la suggestion confirmée, avec son mouvement", suggestionConfirmee?.statut === "confirmee" && suggestionConfirmee.mouvementId !== null)
    const depenseProposee = await proprietaire.budgetExpense.findFirst({ where: { teamId: team.id, origine: "proposee" } })
    controle("la dépense proposée est confirmée par un humain, avec son origine", depenseProposee?.confirmee === true && depenseProposee?.origineRef === `garage:${idSuggestion}`)

    // Suggestion confirmée depuis la page À confirmer : l'action « mouvement à confirmer » est levée.
    const idPage = await budget.proposerMouvementDans(ctx, {
      appOrigine: "garage",
      evenementOrigine: "garage.piece_achetee",
      sens: "depense",
      montant: 1_200,
      categoryId: catPieces,
      libelle: "Suggestion confirmée par la page",
      eventId: epreuveBudget,
    })
    await budget.confirmerSuggestionDans(ctx, idPage)
    const actionPage = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: `budget_suggestion:${idPage}` } })
    controle("confirmer depuis la page lève l'action « mouvement à confirmer »", actionPage?.statut === "annulee", actionPage?.statut ?? "absente")

    // Suggestion ignorée depuis la page : l'action est levée aussi.
    const idIgnoree = await budget.proposerMouvementDans(ctx, {
      appOrigine: "garage",
      evenementOrigine: "garage.intervention_facturee",
      sens: "depense",
      montant: 900,
      categoryId: catPieces,
      libelle: "Suggestion ignorée",
      eventId: epreuveBudget,
    })
    await budget.ignorerSuggestionDans(ctx, idIgnoree)
    const actionIgnoree = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: `budget_suggestion:${idIgnoree}` } })
    controle("ignorer depuis la page lève l'action « mouvement à confirmer »", actionIgnoree?.statut === "annulee", actionIgnoree?.statut ?? "absente")

    // Action restée en attente pour une suggestion déjà traitée (état hérité de la version précédente) :
    // la décision de la boîte ne la rouvre pas, elle reste close, sans motif de refus.
    await proprietaire.coreAction.update({ where: { id: actionIgnoree?.id ?? "" }, data: { statut: "en_attente" } })
    await decider(ctx, actionIgnoree?.id ?? "", "confirmer")
    const actionDecideeBudget = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: `budget_suggestion:${idIgnoree}` } })
    controle(
      "une décision sur une suggestion déjà traitée ne rouvre pas l'action",
      actionDecideeBudget?.statut === "decidee" && actionDecideeBudget?.messageRefus === null,
      `${actionDecideeBudget?.statut ?? "absente"} / ${actionDecideeBudget?.messageRefus ?? "sans motif"}`,
    )

    // Remboursement : partiel, puis un trop qui dépasse le reste dû est refusé.
    await budget.rembourserDans(ctx, { personId: personneBus, montant: 50_000, moyen: "virement", payerId: caisse?.id ?? "", lignes: [{ expenseId: depense1, montant: 50_000 }] })
    const apresRemboursement = await proprietaire.budgetExpense.findUnique({ where: { id: depense1 } })
    controle("un remboursement partiel passe la dépense à « partiel »", apresRemboursement?.remboursement === "partiel", apresRemboursement?.remboursement ?? "")
    let refusRemb = ""
    try {
      await budget.rembourserDans(ctx, { personId: personneBus, montant: 100_000, moyen: "virement", payerId: caisse?.id ?? "", lignes: [{ expenseId: depense1, montant: 100_000 }] })
    } catch (erreur) {
      refusRemb = erreur instanceof budget.ErreurBudget ? erreur.message : String(erreur)
    }
    controle("un remboursement qui dépasse le reste dû est refusé", refusRemb.includes("dépasse"), refusRemb)

    // 14. Liaisons Saison-Budget (tâche 2.7) : une app propose, elle n'écrit jamais chez l'autre ; pas de boucle
    //     dans les deux sens ; un seul mouvement ; widgets lus en base ; modification et suppression d'une dépense.
    const liaisons = await import("../src/apps/budget/liaisons-serveur")
    const widgets = await import("../src/apps/budget/widgets-serveur")
    controle("aucune proposition pour l'engagement avant le premier paiement", (await proprietaire.budgetSuggestion.count({ where: { teamId: team.id, entryId: entryFuture, deletedAt: null } })) === 0)
    await emettre(ctx, "saison.engagement_paye", { entryId: entryFuture, eventId: epreuveFutureBus.id, montant_paye: 45_000, devise: "EUR", payeurPersonId: personneBus })
    await emettre(ctx, "saison.engagement_paye", { entryId: entryFuture, eventId: epreuveFutureBus.id, montant_paye: 46_000, devise: "EUR", payeurPersonId: personneBus })
    const propositions = await proprietaire.budgetSuggestion.findMany({ where: { teamId: team.id, entryId: entryFuture, deletedAt: null } })
    controle(
      "un paiement d'engagement propose une dépense ; le second paiement met à jour la même proposition",
      propositions.length === 1 && propositions[0].montant === 46_000 && propositions[0].statut === "en_attente",
      JSON.stringify(propositions.map((p) => [p.montant, p.statut])),
    )
    const actionProposition = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: propositions[0]?.actionCle ?? "" } })
    await decider(ctx, actionProposition?.id ?? "", "confirmer")
    const depenseDeSaison = await proprietaire.budgetExpense.findFirst({ where: { teamId: team.id, entryId: entryFuture, deletedAt: null } })
    controle("la confirmation crée la dépense, confirmée, avec l'origine saison:<entrée>", depenseDeSaison?.confirmee === true && depenseDeSaison?.origineRef === `saison:${entryFuture}`, depenseDeSaison?.origineRef ?? "aucune dépense")
    controle("une dépense venant de Saison ne demande pas de « marquer payé » en retour", (await proprietaire.coreAction.count({ where: { teamId: team.id, cleUnicite: `marquer_paye:${entryFuture}` } })) === 0)
    controle("un seul mouvement pour cet engagement, après les deux paiements et la confirmation", (await proprietaire.budgetExpense.count({ where: { teamId: team.id, entryId: entryFuture, deletedAt: null } })) === 1)

    // Dans l'autre sens : une dépense d'engagement saisie dans Budget demande « marquer payé » à Saison, et le
    // paiement qui suit ne propose plus rien à Budget.
    const entreeDirecte = await creerEngagementDans(ctx, { eventId: epreuveBudget, vehicleId: vehiculeBus.id })
    await budget.creerDepenseDans(ctx, { montant: 30_000, categoryId: catEngagement, libelle: "Engagement direct", eventId: epreuveBudget, entryId: entreeDirecte, payerId: payeurMoi?.id ?? "" }, "ecriture")
    controle("une dépense d'engagement saisie dans Budget demande « marquer payé » à Saison", (await proprietaire.coreAction.count({ where: { teamId: team.id, cleUnicite: `marquer_paye:${entreeDirecte}`, statut: "en_attente" } })) === 1)
    const lue = await liaisons.lireDepenseEngagementDans(ctx, entreeDirecte)
    controle("Saison lit la dépense d'engagement par la fonction de Budget", lue.montant === 30_000 && lue.mode === "virement", JSON.stringify(lue))
    await emettre(ctx, "saison.engagement_paye", { entryId: entreeDirecte, eventId: epreuveBudget, montant_paye: 30_000, devise: "EUR", payeurPersonId: personneBus })
    controle("le paiement de cet engagement ne propose rien en retour : pas de boucle", (await proprietaire.budgetSuggestion.count({ where: { teamId: team.id, entryId: entreeDirecte, deletedAt: null } })) === 0)

    // Engagement payé saisi directement dans Saison : la demande « Marquer payé » restée en attente est levée.
    const saisonServices = await import("../src/apps/saison/services-serveur")
    await saisonServices.enregistrerPaiementDans(ctx, entreeDirecte, { payeLe: "2030-09-01", mode: "especes", montant: 30_000 })
    const actionLevee = await proprietaire.coreAction.findFirst({ where: { teamId: team.id, cleUnicite: `marquer_paye:${entreeDirecte}` } })
    controle("un paiement saisi dans Saison lève l'action « Marquer payé » restée en attente", actionLevee?.statut === "annulee", actionLevee?.statut ?? "absente")
    const paiementEspeces = await proprietaire.saisonRegistration.findFirst({ where: { entryId: entreeDirecte, teamId: team.id }, select: { modePaiement: true } })
    controle("les espèces sont transmises à Saison telles quelles", paiementEspeces?.modePaiement === "especes", paiementEspeces?.modePaiement ?? "aucun")

    // Widgets lus en base.
    controle("le widget « mouvements à confirmer » compte les suggestions en attente", (await widgets.widgetMouvementsAConfirmerDans(ctx)) === (await proprietaire.budgetSuggestion.count({ where: { teamId: team.id, statut: "en_attente", deletedAt: null } })))
    const widgetSaison = await widgets.widgetSaisonContrePrevisionnelDans(ctx)
    controle("le widget saison renvoie rien tant qu'aucune saison n'est en cours, ou un chiffre réel", widgetSaison === null || typeof widgetSaison.reelCentimes === "number")

    // Modification et suppression d'une dépense (même règle en ligne et en synchro).
    const idSaison = depenseDeSaison?.id ?? ""
    await budget.modifierDepenseDans(ctx, idSaison, { montant: 47_000, categoryId: catEngagement, libelle: "Engagement modifié", payerId: depenseDeSaison?.payerId ?? "", eventId: epreuveBudget }, "ecriture")
    const modifiee = await proprietaire.budgetExpense.findUnique({ where: { id: idSaison } })
    controle("une dépense modifiée prend ses nouveaux montant et libellé", modifiee?.montant === 47_000 && modifiee?.libelle === "Engagement modifié")
    await budget.supprimerDepenseDans(ctx, idSaison, "ecriture")
    const supprimee = await proprietaire.budgetExpense.findUnique({ where: { id: idSaison } })
    controle("une dépense supprimée reste en base, marquée supprimée", supprimee?.deletedAt != null)

    // 14. Voiture (tâche 3.2) : création d'un véhicule (un seul événement), pose d'un logo, échéances des papiers
    //     (un rappel par papier et par échéance, rien pour un papier sans échéance).
    const voiture = await import("../src/apps/voiture/services-serveur")
    const { jourDeParis } = await import("../src/core/dates")
    const { recalculerPapiersDans } = voiture

    const avantEmplacements = await compter("voiture.emplacement_modifie")
    const vehiculeVoiture = await voiture.creerVehiculeDans(ctx, { nom: "Saxo bus", type: "course", gabaritCle: "citadine_3p_saxo" })
    const apresEmplacements = await compter("voiture.emplacement_modifie")
    controle("la création d'un véhicule émet un seul voiture.emplacement_modifie", apresEmplacements - avantEmplacements === 1, `${apresEmplacements - avantEmplacements}`)
    const nbSlots = await proprietaire.voitureSlot.count({ where: { teamId: team.id, vehicleId: vehiculeVoiture, deletedAt: null } })
    controle("le véhicule reçoit les quinze emplacements de la Saxo (onze en vues dessinées, quatre hors plan)", nbSlots === 15, `${nbSlots}`)

    // Sans gabarit (« Aucun gabarit ») : pas d'emplacement, donc pas d'événement d'emplacement.
    const avantSansGabarit = await compter("voiture.emplacement_modifie")
    const vehiculeNu = await voiture.creerVehiculeDans(ctx, { nom: "Nu bus", type: "reco", gabaritCle: null })
    const slotsNu = await proprietaire.voitureSlot.count({ where: { teamId: team.id, vehicleId: vehiculeNu, deletedAt: null } })
    controle("un véhicule sans gabarit n'a aucun emplacement et n'émet rien sur les emplacements", slotsNu === 0 && (await compter("voiture.emplacement_modifie")) === avantSansGabarit, `${slotsNu}`)

    const slotPortiere = await proprietaire.voitureSlot.findFirst({ where: { teamId: team.id, vehicleId: vehiculeVoiture, vue: "droite", nom: "Portière" } })
    const reservation = await voiture.reserverEmplacementDans(ctx, slotPortiere?.id ?? "", { partenaireNom: "Partenaire bus" })
    const avantPose = await compter("voiture.logo_pose")
    await voiture.poserLogoDans(ctx, reservation, { poseLe: jourDeParis(new Date()) })
    controle("poserLogo émet voiture.logo_pose", (await compter("voiture.logo_pose")) - avantPose === 1)

    const echeanceProche = jourDeParis(new Date(Date.now() + 10 * 86_400_000))
    const papierProche = await voiture.creerPapierDans(ctx, vehiculeVoiture, { type: "assurance", valableJusquAu: echeanceProche })
    const compterRappel = (paperId: string) =>
      proprietaire.coreDomainEvent.count({
        where: { teamId: team.id, nom: "voiture.papier_expire_bientot", AND: [{ donnees: { path: ["paperId"], equals: paperId } }] },
      })
    await recalculerPapiersDans(ctx)
    await recalculerPapiersDans(ctx)
    const rappelsProche = await compterRappel(papierProche)
    controle("un papier qui expire dans dix jours émet voiture.papier_expire_bientot une seule fois, même après deux ouvertures du QG", rappelsProche === 1, `${rappelsProche}`)

    const papierSansEcheance = await voiture.creerPapierDans(ctx, vehiculeVoiture, { type: "carte_grise", valableJusquAu: null })
    await recalculerPapiersDans(ctx)
    const rappelsSansEcheance = await compterRappel(papierSansEcheance)
    controle("un papier sans échéance n'émet rien", rappelsSansEcheance === 0, `${rappelsSansEcheance}`)

    // Un papier créé déjà expiré lève aussi le rappel, une seule fois, avec un titre qui dit la date passée.
    const echeancePassee = jourDeParis(new Date(Date.now() - 3 * 86_400_000))
    const papierExpire = await voiture.creerPapierDans(ctx, vehiculeVoiture, { type: "controle_technique", valableJusquAu: echeancePassee })
    await recalculerPapiersDans(ctx)
    await recalculerPapiersDans(ctx)
    const rappelsExpire = await compterRappel(papierExpire)
    controle("un papier déjà expiré émet voiture.papier_expire_bientot une seule fois, même après deux ouvertures du QG", rappelsExpire === 1, `${rappelsExpire}`)
    const actionsExpire = await proprietaire.coreAction.findMany({ where: { teamId: team.id, cleUnicite: `papier:${papierExpire}:${echeancePassee}` } })
    controle("un papier déjà expiré lève une seule action, titrée « expiré depuis le »", actionsExpire.length === 1 && actionsExpire[0].titre.includes("expiré depuis le"), `${actionsExpire.length}`)

    // Fiches de réglage (brief 3.3) : un champ essentiel ne se masque pas ; une fiche se crée, et sert de départ.
    const essentielRefuse = await voiture.masquerChampsDans(ctx, ["pression_froid_avg"]).then(
      () => false,
      () => true,
    )
    controle("un champ essentiel ne peut pas être masqué", essentielRefuse)
    await voiture.masquerChampsDans(ctx, ["rapport_pont"])
    const fichePont = await voiture.creerReglageDans(ctx, vehiculeVoiture, { date: jourDeParis(new Date()), valeurs: { pression_froid_avg: 2.1, rapport_pont: 4.3 }, note: 4 })
    const relueFiche = await proprietaire.voitureSetup.findFirst({ where: { id: fichePont } })
    controle("la fiche de réglage garde sa note et ses valeurs", relueFiche?.note === 4 && (relueFiche?.valeurs as Record<string, unknown>)?.pression_froid_avg === 2.1)
    const depart = await voiture.valeursDeDepartDans(ctx, vehiculeVoiture, null)
    controle("la dernière fiche sert de départ à la suivante", depart.pression_froid_avg === 2.1)
    await voiture.masquerChampsDans(ctx, [])

    // Widgets de Voiture (brief 3.3, section 8) : lus en base. Le premier papier à traiter est expiré (il passe
    // avant les papiers à renouveler) ; les emplacements libres se comptent sur les véhicules actifs.
    const widgetsVoiture = await import("../src/apps/voiture/widgets-serveur")
    const { SEUIL_RENOUVELLEMENT_JOURS } = await import("../src/apps/voiture/regles")
    const maintenantWidget = new Date()
    const seuilPapiers = new Date(`${jourDeParis(maintenantWidget)}T00:00:00Z`)
    seuilPapiers.setUTCDate(seuilPapiers.getUTCDate() + SEUIL_RENOUVELLEMENT_JOURS)
    const attendusPapiers = await proprietaire.voiturePaper.count({
      where: { teamId: team.id, deletedAt: null, vehicle: { actif: true, deletedAt: null }, valableJusquAu: { not: null, lte: seuilPapiers } },
    })
    const widgetPapiers = await widgetsVoiture.widgetPapiersARenouvelerDans(ctx, maintenantWidget)
    controle("le widget papiers compte les papiers à renouveler ou expirés en base", widgetPapiers.nombre === attendusPapiers && attendusPapiers >= 1, `${widgetPapiers.nombre}/${attendusPapiers}`)
    controle("le widget papiers désigne d'abord un papier expiré", widgetPapiers.premier?.statut === "expire")
    const widgetEmplacements = await widgetsVoiture.widgetEmplacementsLibresDans(ctx)
    const attendusLibres = await proprietaire.voitureSlot.count({ where: { teamId: team.id, deletedAt: null, statut: "libre", vehicle: { actif: true, deletedAt: null } } })
    controle("le widget emplacements libres compte tous les véhicules actifs", widgetEmplacements.nombre === attendusLibres && attendusLibres > 0, `${widgetEmplacements.nombre}/${attendusLibres}`)

    // 12. Partenaires (tâche 3.5) : signature, avancement, fin de convention, retard et relance, un seul
    //     événement ou une seule tâche à chaque fois, même après deux ouvertures du QG.
    const partenaires = await import("../src/apps/partenaires/services-serveur")
    const { cleContrepartieEnRetard } = await import("../src/apps/partenaires/charges")
    const { jourParis } = await import("../src/apps/partenaires/regles")
    const saisonPartenaires = randomUUID()
    await proprietaire.coreSeason.create({
      data: { id: saisonPartenaires, teamId: team.id, annee: 2041, nom: "Saison 2041", dateDebut: new Date("2041-01-01"), dateFin: new Date("2041-12-31") },
    })
    const compterEvenements = async (nom: string, champ: string, valeur: string) =>
      (await proprietaire.coreDomainEvent.findMany({ where: { teamId: team.id, nom } })).filter(
        (e) => (e.donnees as Record<string, unknown>)[champ] === valeur,
      ).length

    const partenaireId = await partenaires.creerProspectDans(ctx, { entreprise: `Garage Verif ${suffixe}`, contact: { prenom: "Ana", nom: "Verif" } })
    const [modele] = await partenaires.lireModelesDans(ctx)
    const conventionId = await partenaires.creerConventionDans(ctx, {
      partnerId: partenaireId,
      templateId: modele.id,
      seasonId: saisonPartenaires,
      dateDebut: "2041-01-01",
      dateFin: "2041-12-31",
    })
    const logoId = await partenaires.ajouterContrepartieDans(ctx, conventionId, { libelle: "Logo sur la voiture", type: "logo_voiture", quantitePromise: 1 })
    await partenaires.modifierContrepartieDans(ctx, logoId, { slotId: randomUUID(), slotNom: "Portière droite" })
    const publicationId = await partenaires.ajouterContrepartieDans(ctx, conventionId, { libelle: "Publication", type: "publication_reseaux", quantitePromise: 2 })
    await partenaires.modifierContrepartieDans(ctx, publicationId, { echeance: "2026-01-15" })

    await partenaires.marquerEnvoyeeDans(ctx, conventionId)
    await partenaires.marquerSigneeDans(ctx, conventionId, { signeeLe: "2041-01-01", signataires: "Jo Koehling ; Ana Verif" })
    const signees = await proprietaire.coreDomainEvent.findMany({ where: { teamId: team.id, nom: "partenaires.convention_signee" } })
    const signee = signees.find((e) => (e.donnees as Record<string, unknown>).agreementId === conventionId)
    const contrepartiesSignee = (signee?.donnees as { contreparties?: Array<{ slotNom: string | null }> } | undefined)?.contreparties ?? []
    controle(
      "marquer signée émet convention_signee avec la contrepartie logo et son emplacement",
      contrepartiesSignee.length === 1 && contrepartiesSignee[0].slotNom === "Portière droite",
      `contreparties : ${contrepartiesSignee.length}`,
    )
    const partenaireSigne = await proprietaire.partenairesPartner.findUnique({ where: { id: partenaireId } })
    controle("la signature fait passer le partenaire au statut partenaire", partenaireSigne?.statut === "partenaire", partenaireSigne?.statut)

    await partenaires.saisirAvancementDans(ctx, logoId, 1)
    await partenaires.saisirAvancementDans(ctx, logoId, 1)
    controle(
      "saisir la quantité promise émet contrepartie_tenue une seule fois",
      (await compterEvenements("partenaires.contrepartie_tenue", "benefitId", logoId)) === 1,
    )

    // Dates passées : signée → en cours → terminée au recalcul, en une fois ; l'événement part une seule fois.
    await proprietaire.partenairesAgreement.update({ where: { id: conventionId }, data: { dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-06-30") } })
    await partenaires.recalculerPourQg(ctx, "gestion")
    await partenaires.recalculerPourQg(ctx, "gestion")
    const conventionTerminee = await proprietaire.partenairesAgreement.findUnique({ where: { id: conventionId } })
    controle("le recalcul fait passer la convention à terminée", conventionTerminee?.statut === "terminee", conventionTerminee?.statut)
    controle(
      "convention_terminee est émis une seule fois, malgré deux ouvertures du QG",
      (await compterEvenements("partenaires.convention_terminee", "agreementId", conventionId)) === 1,
    )

    // Contrepartie en retard (échéance passée, non tenue) : un événement et une action, une seule fois.
    controle(
      "contrepartie en retard : un seul événement après deux ouvertures du QG",
      (await compterEvenements("partenaires.contrepartie_en_retard", "benefitId", publicationId)) === 1,
    )
    const actionsRetard = await proprietaire.coreAction.count({ where: { teamId: team.id, cleUnicite: cleContrepartieEnRetard(publicationId, "2026-01-15") } })
    controle("contrepartie en retard : une seule action levée", actionsRetard === 1, String(actionsRetard))

    // Relance due aujourd'hui : un événement et une seule tâche, même après deux ouvertures du QG.
    const prospectRelance = await partenaires.creerProspectDans(ctx, { entreprise: `Relance Verif ${suffixe}` })
    await partenaires.modifierPartenaireDans(ctx, prospectRelance, { prochaineRelance: jourParis(new Date()) })
    await partenaires.recalculerPourQg(ctx, "gestion")
    await partenaires.recalculerPourQg(ctx, "gestion")
    controle("relance due : un seul événement relance_due", (await compterEvenements("partenaires.relance_due", "partnerId", prospectRelance)) === 1)
    const taches = await proprietaire.coreTask.count({ where: { teamId: team.id, app: "partenaires", ficheId: prospectRelance } })
    controle("relance due : une seule tâche core_task", taches === 1, String(taches))

    console.log("\nBus et boîte d'actions vérifiés : tous les contrôles passent.")
  } finally {
    // Nettoyage avec le rôle propriétaire, dans l'ordre des clés étrangères.
    await proprietaire.budgetReimbursementLine.deleteMany({ where: { teamId: team.id } })
    await proprietaire.budgetReimbursement.deleteMany({ where: { teamId: team.id } })
    await proprietaire.budgetSuggestion.deleteMany({ where: { teamId: team.id } })
    await proprietaire.budgetForecast.deleteMany({ where: { teamId: team.id } })
    await proprietaire.budgetIncome.deleteMany({ where: { teamId: team.id } })
    await proprietaire.budgetExpense.deleteMany({ where: { teamId: team.id } })
    await proprietaire.budgetPayer.deleteMany({ where: { teamId: team.id } })
    await proprietaire.budgetCategory.deleteMany({ where: { teamId: team.id } })
    await proprietaire.saisonResult.deleteMany({ where: { teamId: team.id } })
    await proprietaire.saisonReadiness.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreAppAccess.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreUser.deleteMany({ where: { email: { endsWith: `-${suffixe}@exemple.invalid` } } })
    await proprietaire.saisonRegistration.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreEventEntry.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreEvent.deleteMany({ where: { teamId: team.id } })
    await proprietaire.voitureSlotAssignment.deleteMany({ where: { teamId: team.id } })
    await proprietaire.voitureSetup.deleteMany({ where: { teamId: team.id } })
    await proprietaire.voitureSetupTemplate.deleteMany({ where: { teamId: team.id } })
    await proprietaire.voiturePaper.deleteMany({ where: { teamId: team.id } })
    await proprietaire.voitureSlot.deleteMany({ where: { teamId: team.id } })
    await proprietaire.voitureTeamPref.deleteMany({ where: { teamId: team.id } })
    await proprietaire.voitureVehicle.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: team.id } })
    // Partenaires : les enfants d'abord (RESTRICT), puis les contacts et les tâches.
    await proprietaire.partenairesPortalMessage.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesPortalLink.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesProof.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesReport.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesBenefit.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesBenefitCatalog.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesAmendment.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesAgreement.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesTemplate.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesInteraction.deleteMany({ where: { teamId: team.id } })
    await proprietaire.partenairesPartner.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreTask.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreContact.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreSeason.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreAction.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreTeamApp.deleteMany({ where: { teamId: team.id } })
    await proprietaire.coreMembership.deleteMany({ where: { id: adhesion } })
    await proprietaire.corePerson.deleteMany({ where: { teamId: team.id } })
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
