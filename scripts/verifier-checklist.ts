// Vérifie Check-lists contre la base réelle (tâche 5.5a, brief « Livraison »).
// Usage : pnpm db:verifier-checklist
//
// La team de test, ses membres, une épreuve, un engagement, un véhicule, des listes et des points sont créés avec le
// rôle propriétaire ; les services réels (changement de statut, retrait de point) sont appelés avec le rôle applicatif
// et leur contexte. Tout est supprimé dans un finally. Une ligne par contrôle ; exit 1 au premier écart.
//
// Contrôles : journal de coches en ajout seul ; avancement et zone recalculés après un changement de statut ; l'assistance
// refusée hors liste ouverte et sur le point d'un autre ; modèles fournis lisibles, jamais écrits ; modèles d'une autre
// team invisibles ; une seule action de réassignation pour un membre retiré, levée quand plus rien n'est à faire.

import { randomUUID } from "node:crypto"

import { config as chargerEnv } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"

import { jourParis } from "./lib/dates"

chargerEnv({ path: ".env.local" })
chargerEnv()

const urlProprietaire = process.env.DATABASE_URL_MIGRATION
if (!urlProprietaire) {
  console.error("DATABASE_URL_MIGRATION absente : impossible de préparer les données de test.")
  process.exit(1)
}

const proprietaire = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlProprietaire }) })

class EcartChecklist extends Error {}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartChecklist(`${libelle}${detail ? ` (${detail})` : ""}`)
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
  const services = await import("../src/apps/checklist/services-serveur")
  const liaisons = await import("../src/apps/checklist/liaisons-serveur")
  const { prismaPourTeam } = await import("../src/lib/prisma")

  const suffixe = randomUUID().slice(0, 8)
  const team = { id: randomUUID(), nom: `Verif checklist ${suffixe}`, slug: `verif-checklist-${suffixe}` }
  const autreTeam = { id: randomUUID(), nom: `Verif checklist autre ${suffixe}`, slug: `verif-checklist-autre-${suffixe}` }
  const responsable = { user: randomUUID(), adhesion: randomUUID(), email: `verif-checklist-resp-${suffixe}@exemple.invalid` }
  const assistance = { user: randomUUID(), adhesion: randomUUID(), email: `verif-checklist-ass-${suffixe}@exemple.invalid` }
  const saison = randomUUID()
  const vehicule = randomUUID()
  const epreuve = randomUUID()
  const engagement = randomUUID()
  const equipes = [team.id, autreTeam.id]
  const ctxResp = { teamId: team.id, userId: responsable.user, membership: { id: responsable.adhesion, role: "responsable" as const } }
  const ctxAss = { teamId: team.id, userId: assistance.user, membership: { id: assistance.adhesion, role: "assistance" as const } }

  try {
    await proprietaire.coreTeam.createMany({ data: [{ id: team.id, nom: team.nom, slug: team.slug }, { id: autreTeam.id, nom: autreTeam.nom, slug: autreTeam.slug }] })
    await proprietaire.coreUser.createMany({
      data: [
        { id: responsable.user, email: responsable.email },
        { id: assistance.user, email: assistance.email },
      ],
    })
    await proprietaire.coreMembership.createMany({
      data: [
        { id: responsable.adhesion, teamId: team.id, userId: responsable.user, role: "responsable", statut: "actif" },
        { id: assistance.adhesion, teamId: team.id, userId: assistance.user, role: "assistance", statut: "actif" },
      ],
    })
    await proprietaire.coreVehicle.create({ data: { id: vehicule, teamId: team.id, type: "course", nomCourt: `Voiture ${suffixe}` } })
    await proprietaire.coreSeason.create({
      data: { id: saison, teamId: team.id, annee: 2026, nom: `Saison ${suffixe}`, dateDebut: new Date("2026-01-01T00:00:00Z"), dateFin: new Date("2026-12-31T00:00:00Z") },
    })
    await proprietaire.coreEvent.create({
      data: {
        id: epreuve,
        teamId: team.id,
        seasonId: saison,
        type: "rallye",
        nom: `Épreuve ${suffixe}`,
        dateDebut: new Date("2026-06-01T00:00:00Z"),
        dateFin: new Date("2026-06-01T00:00:00Z"),
        statut: "envisagee",
      },
    })
    await proprietaire.coreEventEntry.create({ data: { id: engagement, teamId: team.id, eventId: epreuve, vehicleId: vehicule } })

    // Une liste de la team avec trois points : un critique à faire, deux normaux à faire.
    const liste = randomUUID()
    const section = randomUUID()
    const pointCritique = randomUUID()
    const pointNormal = randomUUID()
    const pointAssistance = randomUUID()
    await proprietaire.checklistList.create({
      data: { id: liste, teamId: team.id, epreuveId: epreuve, engagementId: engagement, vehiculeId: vehicule, titre: `Liste ${suffixe}`, phase: "avant_depart", createdBy: responsable.user },
    })
    await proprietaire.checklistSection.create({ data: { id: section, teamId: team.id, listeId: liste, titre: `Section ${suffixe}`, createdBy: responsable.user } })
    await proprietaire.checklistItem.createMany({
      data: [
        { id: pointCritique, teamId: team.id, sectionId: section, libelle: `Critique ${suffixe}`, critique: true, createdBy: responsable.user },
        { id: pointNormal, teamId: team.id, sectionId: section, libelle: `Normal ${suffixe}`, createdBy: responsable.user },
        { id: pointAssistance, teamId: team.id, sectionId: section, libelle: `Assistance ${suffixe}`, createdBy: assistance.user },
      ],
    })

    // 1. Avancement et zone recalculés après un changement de statut, et une ligne de journal.
    await services.changerStatutPointDans(ctxResp, "gestion", pointNormal, "fait")
    const apresFait = await proprietaire.checklistList.findFirst({ where: { id: liste } })
    // Poids : critique 2, normal 1, normal 1 = 4. Un normal fait : 1 / 4, soit 25 %. Pas de critique ouvert, mais 25 % : orange.
    controle("l'avancement est recalculé après un changement de statut (1 / 4 = 25 %)", apresFait?.avancement === 25, `${apresFait?.avancement}`)
    controle("la zone reste orange sous le seuil", apresFait?.zone === "orange", `${apresFait?.zone}`)
    controle("le statut passe à en cours", apresFait?.statut === "en_cours", `${apresFait?.statut}`)
    const journal = await proprietaire.checklistCheckLog.findMany({ where: { pointId: pointNormal } })
    controle("un changement de statut écrit une ligne de journal", journal.length === 1 && journal[0].nouveauStatut === "fait", `${journal.length}`)
    controle("le journal garde l'ancien statut et l'auteur", journal[0]?.ancienStatut === "a_faire" && journal[0]?.parId === responsable.user)

    // 2. Journal en ajout seul : le rôle applicatif ne met à jour ni ne supprime une ligne.
    const app = prismaPourTeam(team.id, responsable.user)
    const logId = journal[0]?.id ?? ""
    const refusMaj = await refuse(app.checklistCheckLog.update({ where: { id: logId }, data: { horsLigne: true } }))
    controle("le journal refuse la mise à jour au rôle applicatif", refusMaj !== null, refusMaj ?? "aucun refus")
    const refusSuppression = await refuse(app.checklistCheckLog.delete({ where: { id: logId } }))
    controle("le journal refuse la suppression au rôle applicatif", refusSuppression !== null, refusSuppression ?? "aucun refus")
    const lectureJournal = await app.checklistCheckLog.findFirst({ where: { id: logId } })
    controle("le rôle applicatif lit le journal de sa team", lectureJournal?.id === logId)

    // 3. Assistance : refusée sur une liste fermée, puis sur le point d'un autre une fois la liste ouverte.
    const refusFermee = await refuse(services.changerStatutPointDans(ctxAss, "contribution", pointNormal, "sans_objet"))
    controle("l'assistance est refusée hors liste ouverte, avec la raison", refusFermee?.includes("n'est pas ouverte à l'assistance") === true, refusFermee ?? "aucun refus")

    await proprietaire.checklistList.update({ where: { id: liste }, data: { ouverteAssistance: true } })
    await services.changerStatutPointDans(ctxAss, "contribution", pointCritique, "fait")
    const coche = await proprietaire.checklistItem.findFirst({ where: { id: pointCritique } })
    controle("l'assistance coche un point d'une liste ouverte, même créé par un autre", coche?.statut === "fait")

    const refusRetraitAutre = await refuse(services.retirerPointDans(ctxAss, "contribution", pointNormal))
    controle("l'assistance ne retire pas le point d'un autre", refusRetraitAutre?.includes("ajoutés") === true, refusRetraitAutre ?? "aucun refus")
    await services.retirerPointDans(ctxAss, "contribution", pointAssistance)
    const retire = await proprietaire.checklistItem.findFirst({ where: { id: pointAssistance } })
    controle("l'assistance retire un point qu'elle a créé", retire?.deletedAt !== null)

    // 4. Modèles : un modèle fourni est lisible par la team, jamais écrit ; un modèle d'une autre team est invisible.
    const fourni = randomUUID()
    const deLAutre = randomUUID()
    await proprietaire.checklistTemplate.createMany({
      data: [
        { id: fourni, teamId: null, nom: `Fourni ${suffixe}`, portee: "engagement", fourni: true },
        { id: deLAutre, teamId: autreTeam.id, nom: `Autre ${suffixe}`, portee: "engagement", fourni: false },
      ],
    })
    const modeleFourni = await app.checklistTemplate.findFirst({ where: { id: fourni } })
    controle("la team lit un modèle fourni", modeleFourni?.id === fourni)
    const refusEcritureFourni = await refuse(app.checklistTemplate.update({ where: { id: fourni }, data: { nom: "Modifié" } }))
    controle("la team n'écrit jamais un modèle fourni", refusEcritureFourni !== null, refusEcritureFourni ?? "aucun refus")
    const modeleAutre = await app.checklistTemplate.findFirst({ where: { id: deLAutre } })
    controle("la team ne lit pas le modèle d'une autre team", modeleAutre === null)

    // 5. Membre retiré : une action « Réassigner les points » (une seule), levée quand plus rien n'est à faire.
    const membreRetire = { user: randomUUID(), adhesion: randomUUID(), personne: randomUUID(), email: `verif-checklist-retire-${suffixe}@exemple.invalid` }
    const pointRetire = randomUUID()
    await proprietaire.coreUser.create({ data: { id: membreRetire.user, email: membreRetire.email } })
    await proprietaire.corePerson.create({ data: { id: membreRetire.personne, teamId: team.id, nom: "Retiré", prenom: `Verif ${suffixe}` } })
    await proprietaire.coreMembership.create({
      data: { id: membreRetire.adhesion, teamId: team.id, userId: membreRetire.user, role: "equipage", statut: "parti", personId: membreRetire.personne },
    })
    await proprietaire.checklistItem.create({
      data: { id: pointRetire, teamId: team.id, sectionId: section, libelle: `Retiré ${suffixe}`, personneId: membreRetire.personne, createdBy: responsable.user },
    })
    await liaisons.proposerReassignationDans(ctxResp, membreRetire.adhesion)
    await liaisons.proposerReassignationDans(ctxResp, membreRetire.adhesion)
    const actionsOuvertes = await proprietaire.coreAction.findMany({
      where: { teamId: team.id, cleUnicite: `reassigner_points:${membreRetire.personne}` },
      select: { statut: true },
    })
    controle("une seule action « Réassigner les points » pour la personne retirée", actionsOuvertes.length === 1, `${actionsOuvertes.length}`)
    controle("l'action est en attente", actionsOuvertes[0]?.statut === "en_attente", actionsOuvertes[0]?.statut)

    await services.changerStatutPointDans(ctxResp, "gestion", pointRetire, "fait")
    const levee = await proprietaire.coreAction.findMany({
      where: { teamId: team.id, cleUnicite: `reassigner_points:${membreRetire.personne}` },
      select: { statut: true },
    })
    controle("l'action est levée quand plus aucun point n'est à faire ou en problème", levee[0]?.statut === "annulee", levee[0]?.statut)
  } finally {
    await proprietaire.checklistCheckLog.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistItem.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistSection.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistList.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistTemplateItem.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistTemplateSection.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistTemplate.deleteMany({ where: { OR: [{ teamId: { in: equipes } }, { nom: { endsWith: suffixe } }] } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAction.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEventEntry.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreSeason.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAppAccess.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.corePerson.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreUser.deleteMany({ where: { email: { endsWith: `-${suffixe}@exemple.invalid` } } })
    await proprietaire.coreTeam.deleteMany({ where: { id: { in: equipes } } })
    await proprietaire.$disconnect()
  }
}

main()
  .then(() => {
    console.log("\nCheck-lists vérifiées : tous les contrôles passent.")
    process.exit(0)
  })
  .catch((erreur) => {
    console.error(`\n${erreur instanceof Error ? erreur.message : erreur}`)
    process.exit(1)
  })
