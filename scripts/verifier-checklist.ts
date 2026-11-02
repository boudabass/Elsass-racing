// Vérifie Check-lists contre la base réelle (tâche 5.5a, brief « Livraison »).
// Usage : pnpm db:verifier-checklist
//
// La team de test, ses membres, une épreuve, un engagement, un véhicule, des listes et des points sont créés avec le
// rôle propriétaire ; les services réels (changement de statut, retrait de point) sont appelés avec le rôle applicatif
// et leur contexte. Tout est supprimé dans un finally. Une ligne par contrôle ; exit 1 au premier écart.
//
// Contrôles : journal de coches en ajout seul ; avancement et zone recalculés après un changement de statut ; l'assistance
// refusée hors liste ouverte et sur le point d'un autre ; modèles fournis lisibles, jamais écrits ; modèles d'une autre
// team invisibles ; une seule action de réassignation pour un membre retiré, levée quand plus rien n'est à faire ; un
// problème sur un point lié à un organe ne touche aucune table d'une autre app, et l'ordre Garage n'existe qu'à
// l'acceptation (5.7a).

import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

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

// Fin volontaire d'une transaction de contrôle : tout ce qu'elle a écrit est annulé.
class AnnulationVerification extends Error {}

// Instructions SQL d'une migration, dans l'ordre : sans les lignes de commentaire, coupées au point-virgule. Le fichier
// est joué tel quel : le contrôle ne recopie pas la requête de conversion.
function instructionsMigration(nom: string): string[] {
  const texte = readFileSync(resolve("prisma/migrations", nom, "migration.sql"), "utf8")
  return texte
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((instruction) => instruction.trim())
    .filter((instruction) => instruction.length > 0)
}

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

    // 6. Migration des boutons-liens (5.6 §0) : des actions au format ancien, jouées par le fichier de la migration, dans
    // une transaction annulée. Rien ne reste en base, même sur une base partagée.
    await proprietaire
      .$transaction(
        async (tx) => {
          const personne = randomUUID()
          const licence = randomUUID()
          const gear = randomUUID()
          await tx.corePerson.create({ data: { id: personne, teamId: team.id, nom: "Lien", prenom: `Verif ${suffixe}` } })
          await tx.equipeLicence.create({ data: { id: licence, teamId: team.id, personId: personne, type: "autre" } })
          await tx.equipeGear.create({ data: { id: gear, teamId: team.id, personId: personne, type: "casque" } })

          const base = { teamId: team.id, titre: "Verif boutons", destinataires: { roles: ["responsable"] }, priorite: 5 }
          const ancien = [{ cle: "renouveler", libelle: "Renouveler" }]
          await tx.coreAction.createMany({
            data: [
              { ...base, id: randomUUID(), appOrigine: "equipe", type: "licence_a_renouveler", ficheType: "licence", ficheId: licence, cleUnicite: `boutons-${suffixe}-licence`, boutons: ancien, statut: "en_attente" },
              { ...base, id: randomUUID(), appOrigine: "equipe", type: "homologation_a_renouveler", ficheType: "gear", ficheId: gear, cleUnicite: `boutons-${suffixe}-gear`, boutons: ancien, statut: "en_attente" },
              { ...base, id: randomUUID(), appOrigine: "equipe", type: "disponibilite_a_repondre", cleUnicite: `boutons-${suffixe}-dispo`, boutons: [{ cle: "repondre", libelle: "Répondre" }], statut: "en_attente" },
              { ...base, id: randomUUID(), appOrigine: "checklist", type: "reassigner_points", cleUnicite: `boutons-${suffixe}-reassign`, boutons: [{ cle: "voir", libelle: "Voir les listes" }], statut: "en_attente" },
              { ...base, id: randomUUID(), appOrigine: "equipe", type: "licence_a_renouveler", ficheType: "licence", ficheId: licence, cleUnicite: `boutons-${suffixe}-decidee`, boutons: ancien, statut: "decidee", decision: "renouveler" },
              { ...base, id: randomUUID(), appOrigine: "checklist", type: "reassigner_points", cleUnicite: `boutons-${suffixe}-deja`, boutons: [{ cle: "voir", libelle: "Voir", lien: "/apps/checklist/autre" }], statut: "en_attente" },
            ],
          })

          const lireBoutons = async () => {
            const lignes = await tx.coreAction.findMany({ where: { teamId: team.id, cleUnicite: { startsWith: `boutons-${suffixe}` } }, select: { cleUnicite: true, boutons: true } })
            return Object.fromEntries(lignes.map((ligne) => [ligne.cleUnicite, JSON.stringify(ligne.boutons)]))
          }
          const avant = await lireBoutons()

          for (const instruction of instructionsMigration("20261101130000_action_boutons_lien")) await tx.$executeRawUnsafe(instruction)
          const apres = await lireBoutons()
          const lien = (cle: string) => JSON.parse(apres[`boutons-${suffixe}-${cle}`] ?? "[]")[0]?.lien

          controle("la licence en attente mène à ses licences", lien("licence") === `/apps/equipe/personnes/${personne}?onglet=licences`, lien("licence"))
          controle("l'homologation en attente mène à l'onglet Équipement", lien("gear") === `/apps/equipe/personnes/${personne}?onglet=equipement`, lien("gear"))
          controle("la disponibilité en attente mène à Prochaine épreuve", lien("dispo") === "/apps/equipe/epreuve", lien("dispo"))
          controle("la réassignation en attente mène à l'accueil de Check-lists", lien("reassign") === "/apps/checklist", lien("reassign"))
          controle("une action décidée ne change pas", apres[`boutons-${suffixe}-decidee`] === avant[`boutons-${suffixe}-decidee`])
          controle("une action déjà au format lien ne change pas", apres[`boutons-${suffixe}-deja`] === avant[`boutons-${suffixe}-deja`])

          for (const instruction of instructionsMigration("20261101130000_action_boutons_lien")) await tx.$executeRawUnsafe(instruction)
          const rejoue = await lireBoutons()
          controle("rejouer la migration ne change rien", JSON.stringify(rejoue) === JSON.stringify(apres))

          throw new AnnulationVerification()
        },
        { timeout: 60000 },
      )
      .catch((erreur) => {
        if (!(erreur instanceof AnnulationVerification)) throw erreur
      })

    // 7. Liaisons (5.7a) : un point lié à un organe passe en problème sans écrire dans les tables d'une autre app (la
    // proposition passe par le socle), et l'ordre Garage n'existe qu'à l'acceptation. Les tables de la team hors
    // Check-lists et socle sont comparées avant et après le changement.
    const typeOrgane = randomUUID()
    const organe = randomUUID()
    const pointOrgane = randomUUID()
    await proprietaire.garageComponentType.create({ data: { id: typeOrgane, teamId: team.id, nom: `Moteur ${suffixe}`, cle: "moteur", icone: "moteur", critique: true, ordre: 1 } })
    await proprietaire.garageVehicleComponent.create({ data: { id: organe, teamId: team.id, vehicleId: vehicule, componentTypeId: typeOrgane, modeUsure: "les_deux" } })
    await proprietaire.checklistItem.create({
      data: { id: pointOrgane, teamId: team.id, sectionId: section, libelle: `Organe ${suffixe}`, lienType: "organe_garage", lienId: organe, createdBy: responsable.user },
    })

    // Tables de la team, hors Check-lists et socle, avec leur nombre de lignes et leur dernière modification.
    const tables = (
      await proprietaire.$queryRawUnsafe<Array<{ table_name: string }>>(
        `SELECT t.table_name FROM information_schema.columns t
           JOIN information_schema.columns r ON r.table_schema = t.table_schema AND r.table_name = t.table_name AND r.column_name = 'rev'
           JOIN information_schema.columns u ON u.table_schema = t.table_schema AND u.table_name = t.table_name AND u.column_name = 'updated_at'
          WHERE t.table_schema = 'public' AND t.column_name = 'team_id'
            AND left(t.table_name, 10) <> 'checklist_' AND left(t.table_name, 5) <> 'core_'`,
      )
    ).map((ligne) => ligne.table_name)
    const empreinte = async (): Promise<Record<string, string>> => {
      const resultat: Record<string, string> = {}
      for (const table of tables) {
        const [ligne] = await proprietaire.$queryRawUnsafe<Array<{ n: number; dernier: string | null }>>(
          `SELECT count(*)::int AS n, max(updated_at)::text AS dernier FROM "${table}" WHERE team_id = $1::uuid`,
          team.id,
        )
        resultat[table] = `${ligne?.n ?? 0}/${ligne?.dernier ?? ""}`
      }
      return resultat
    }
    const ordresDeLOrgane = () => proprietaire.garageWorkOrder.count({ where: { teamId: team.id, vehicleComponentId: organe } })

    const avant = await empreinte()
    await services.changerStatutPointDans(ctxResp, "gestion", pointOrgane, "probleme")
    const apres = await empreinte()
    const modifiees = tables.filter((table) => avant[table] !== apres[table])
    controle("un problème sur un point lié à un organe ne touche aucune table d'une autre app", modifiees.length === 0, modifiees.join(", "))
    controle("aucun ordre Garage avant l'acceptation", (await ordresDeLOrgane()) === 0)

    const garage = await import("../src/apps/garage/ordres-depuis-point-serveur")
    await garage.appliquerDecisionOrdre(ctxResp, { cleUnicite: `ordre_point:${pointOrgane}`, decision: "ignorer", ficheId: organe })
    controle("Ignorer n'ouvre aucun ordre", (await ordresDeLOrgane()) === 0)
    await garage.appliquerDecisionOrdre(ctxResp, { cleUnicite: `ordre_point:${pointOrgane}`, decision: "accepter", ficheId: organe })
    controle("Ouvrir l'ordre crée un ordre sur l'organe du lien", (await ordresDeLOrgane()) === 1)

    // 8. Propositions des écoutes (5.7b) : accepter une proposition n'écrit que dans Check-lists (aucune table d'une autre
    // app, ni des autres tables de la team, ne change) ; cocher ne repasse pas un point fait ; ignorer ne fait rien ; une
    // proposition déjà décidée n'est pas rejouée. La décision passe par le même chemin que la boîte (core.action_decidee).
    const ecoutes = await import("../src/apps/checklist/ecoutes-serveur")
    const decisionDe = (ficheId: string, type: string, decision: "accepter" | "ignorer") =>
      ({ id: randomUUID(), nom: "core.action_decidee", donnees: { actionId: randomUUID(), appOrigine: "checklist", type, decision, ficheId } }) as Parameters<
        typeof ecoutes.appliquerDecisionProposition
      >[1]
    // Un point à faire qui lui est propre : les sections précédentes ont déjà fait avancer les autres.
    const pointCocher = randomUUID()
    await proprietaire.checklistItem.create({ data: { id: pointCocher, teamId: team.id, sectionId: section, libelle: `À cocher ${suffixe}`, createdBy: responsable.user } })

    const evenementSource = randomUUID()
    await proprietaire.coreDomainEvent.create({ data: { id: evenementSource, teamId: team.id, appEmettrice: "garage", nom: "garage.piece_zone_rouge", donnees: {} } })
    const libelleAjoute = `Papier à renouveler : Verif ${suffixe}`
    // Un objet distinct de pointOrgane : la liste en a déjà un lié à l'organe, et un doublon de lien n'est pas ajouté.
    const papierAjoute = randomUUID()
    const propositionAjout = randomUUID()
    await proprietaire.checklistProposal.create({
      data: {
        id: propositionAjout,
        teamId: team.id,
        evenementSourceId: evenementSource,
        type: "ajouter_point",
        contenu: { cle: `papier:${papierAjoute}`, listeId: liste, lienType: "papier_voiture", lienId: papierAjoute, libelle: libelleAjoute, critique: true },
        statut: "proposee",
        createdBy: responsable.user,
      },
    })
    const propositionCocher = randomUUID()
    await proprietaire.checklistProposal.create({
      data: { id: propositionCocher, teamId: team.id, evenementSourceId: evenementSource, type: "cocher_point", contenu: { cle: `point:${pointCocher}`, listeId: liste, pointId: pointCocher }, statut: "proposee", createdBy: responsable.user },
    })

    const avantAjout = await empreinte()
    await ecoutes.appliquerDecisionProposition(ctxResp, decisionDe(propositionAjout, "ajouter_point", "accepter"))
    const apresAjout = await empreinte()
    const modifieesAjout = tables.filter((table) => avantAjout[table] !== apresAjout[table])
    controle("accepter une proposition n'écrit dans aucune table d'une autre app", modifieesAjout.length === 0, modifieesAjout.join(", "))
    const pointAjoute = await proprietaire.checklistItem.findFirst({ where: { teamId: team.id, libelle: libelleAjoute, deletedAt: null } })
    controle("l'acceptation ajoute le point lié à l'objet proposé", pointAjoute?.lienType === "papier_voiture" && pointAjoute?.lienId === papierAjoute, pointAjoute?.lienType ?? "aucun point")
    controle("la proposition acceptée passe à acceptée", (await proprietaire.checklistProposal.findUnique({ where: { id: propositionAjout } }))?.statut === "acceptee")

    await ecoutes.appliquerDecisionProposition(ctxResp, decisionDe(propositionAjout, "ajouter_point", "accepter"))
    const nombreAjoute = await proprietaire.checklistItem.count({ where: { teamId: team.id, libelle: libelleAjoute, deletedAt: null } })
    controle("une proposition déjà décidée n'ajoute pas le point une seconde fois", nombreAjoute === 1, `${nombreAjoute}`)

    await ecoutes.appliquerDecisionProposition(ctxResp, decisionDe(propositionCocher, "cocher_point", "ignorer"))
    controle("ignorer ne coche pas le point", (await proprietaire.checklistItem.findUnique({ where: { id: pointCocher } }))?.statut === "a_faire")
    controle("ignorer passe la proposition à ignorée", (await proprietaire.checklistProposal.findUnique({ where: { id: propositionCocher } }))?.statut === "ignoree")

    const propositionCocherBis = randomUUID()
    await proprietaire.checklistProposal.create({
      data: { id: propositionCocherBis, teamId: team.id, evenementSourceId: evenementSource, type: "cocher_point", contenu: { cle: `point:${pointCocher}`, listeId: liste, pointId: pointCocher }, statut: "proposee", createdBy: responsable.user },
    })
    await ecoutes.appliquerDecisionProposition(ctxResp, decisionDe(propositionCocherBis, "cocher_point", "accepter"))
    controle("accepter coche le point à faire", (await proprietaire.checklistItem.findUnique({ where: { id: pointCocher } }))?.statut === "fait")

    const journalAvant = await proprietaire.checklistCheckLog.count({ where: { pointId: pointCocher } })
    const propositionCocherTer = randomUUID()
    await proprietaire.checklistProposal.create({
      data: { id: propositionCocherTer, teamId: team.id, evenementSourceId: evenementSource, type: "cocher_point", contenu: { cle: `point:${pointCocher}`, listeId: liste, pointId: pointCocher }, statut: "proposee", createdBy: responsable.user },
    })
    await ecoutes.appliquerDecisionProposition(ctxResp, decisionDe(propositionCocherTer, "cocher_point", "accepter"))
    const journalApres = await proprietaire.checklistCheckLog.count({ where: { pointId: pointCocher } })
    controle("un point déjà fait n'est pas recoché : aucune ligne de journal de plus", journalApres === journalAvant, `${journalAvant} -> ${journalApres}`)
  } finally {
    await proprietaire.checklistCheckLog.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistItem.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistSection.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistList.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistTemplateItem.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistTemplateSection.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.checklistTemplate.deleteMany({ where: { OR: [{ teamId: { in: equipes } }, { nom: { endsWith: suffixe } }] } })
    await proprietaire.checklistProposal.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAction.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEventEntry.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreSeason.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageWorkOrder.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageVehicleComponent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.garageComponentType.deleteMany({ where: { teamId: { in: equipes } } })
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
