// Vérifie les services et les règles d'Équipe contre la base réelle (tâche 5.1, brief « Livraison »).
// Usage : pnpm db:verifier-equipe
//
// La team de test, ses membres, une saison, des épreuves et des engagements sont créés avec le rôle propriétaire ;
// les services réels (profil, licence, palier, ressenti, échéances, lectures) sont appelés avec le rôle applicatif.
// Tout est supprimé dans un finally. Une ligne par contrôle ; exit 1 au premier écart.
//
// Contrôles : ressenti invisible en contribution ; palier jamais en baisse après une annulation ; échéance émise une
// seule fois ; l'assistance ne gère que son dossier ; le pilote et le copilote ne s'affectent pas.

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

class EcartEquipe extends Error {}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartEquipe(`${libelle}${detail ? ` (${detail})` : ""}`)
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

// Un jour civil à partir d'aujourd'hui (fuseau de Paris, comme l'application) : « AAAA-MM-JJ », et sa date UTC.
function jourDans(jours: number): { texte: string; date: Date } {
  const instant = new Date(Date.now() + jours * 86_400_000)
  const texte = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
  return { texte, date: new Date(`${texte}T00:00:00Z`) }
}

async function main() {
  // Import dynamique : .env.local doit être chargé avant la création du client applicatif.
  const equipe = await import("../src/apps/equipe/services-serveur")
  const liaisons = await import("../src/apps/equipe/liaisons-serveur")
  const lectures = await import("../src/apps/equipe/lectures-serveur")

  const suffixe = randomUUID().slice(0, 8)
  const team = { id: randomUUID(), nom: `Verif equipe ${suffixe}`, slug: `verif-equipe-${suffixe}` }
  const responsable = { user: randomUUID(), adhesion: randomUUID(), email: `verif-equipe-resp-${suffixe}@exemple.invalid` }
  const assistance = { user: randomUUID(), adhesion: randomUUID(), email: `verif-equipe-ass-${suffixe}@exemple.invalid` }
  const personnes = { pilote: randomUUID(), assistance: randomUUID(), cible: randomUUID() }
  const saison = randomUUID()
  const vehicule = randomUUID()
  const ctxResp = { teamId: team.id, userId: responsable.user, membership: { id: responsable.adhesion, role: "responsable" as const } }
  const ctxAss = { teamId: team.id, userId: assistance.user, membership: { id: assistance.adhesion, role: "assistance" as const } }
  const equipes = [team.id]

  try {
    await proprietaire.coreTeam.create({ data: { id: team.id, nom: team.nom, slug: team.slug } })
    await proprietaire.coreUser.createMany({
      data: [
        { id: responsable.user, email: responsable.email },
        { id: assistance.user, email: assistance.email },
      ],
    })
    await proprietaire.corePerson.createMany({
      data: [
        { id: personnes.pilote, teamId: team.id, nom: "Pilote", prenom: `Verif ${suffixe}` },
        { id: personnes.assistance, teamId: team.id, nom: "Assistance", prenom: `Verif ${suffixe}` },
        { id: personnes.cible, teamId: team.id, nom: "Cible", prenom: `Verif ${suffixe}` },
      ],
    })
    await proprietaire.coreMembership.createMany({
      data: [
        { id: responsable.adhesion, teamId: team.id, userId: responsable.user, role: "responsable", statut: "actif" },
        { id: assistance.adhesion, teamId: team.id, userId: assistance.user, role: "assistance", statut: "actif", personId: personnes.assistance },
      ],
    })
    await proprietaire.coreVehicle.create({ data: { id: vehicule, teamId: team.id, type: "course", nomCourt: `Voiture ${suffixe}` } })
    await proprietaire.coreSeason.create({
      data: { id: saison, teamId: team.id, annee: 2026, nom: `Saison ${suffixe}`, dateDebut: new Date("2026-01-01T00:00:00Z"), dateFin: new Date("2026-12-31T00:00:00Z") },
    })

    // Cinq épreuves passées, chacune avec un engagement où la personne est pilote et un résultat validé.
    const epreuves = Array.from({ length: 5 }, (_, index) => ({ id: randomUUID(), jour: `2026-03-${String(index + 1).padStart(2, "0")}` }))
    await proprietaire.coreEvent.createMany({
      data: epreuves.map((epreuve, index) => ({
        id: epreuve.id,
        teamId: team.id,
        seasonId: saison,
        type: "rallye",
        nom: `Épreuve ${suffixe} ${index + 1}`,
        dateDebut: new Date(`${epreuve.jour}T00:00:00Z`),
        dateFin: new Date(`${epreuve.jour}T00:00:00Z`),
        statut: "terminee",
      })),
    })
    const entrees = epreuves.map((epreuve) => ({ id: randomUUID(), eventId: epreuve.id }))
    await proprietaire.coreEventEntry.createMany({
      data: entrees.map((entree) => ({ id: entree.id, teamId: team.id, eventId: entree.eventId, vehicleId: vehicule, piloteId: personnes.pilote, statut: "arrivee" })),
    })
    await proprietaire.saisonResult.createMany({
      data: entrees.map((entree) => ({ id: randomUUID(), teamId: team.id, entryId: entree.id, statutFinal: "arrivee", validation: "valide" })),
    })

    // 1. Ressenti : invisible en contribution, lisible à l'écriture.
    await proprietaire.equipeMood.create({
      data: { id: randomUUID(), teamId: team.id, personId: personnes.pilote, eventEntryId: entrees[0].id, ressenti: 4 },
    })
    const ficheContribution = await lectures.lireFichePersonne(ctxAss, "contribution", personnes.pilote)
    controle("le ressenti n'est jamais servi au niveau contribution", ficheContribution?.ressenti === null, `${ficheContribution?.ressenti}`)
    const ficheEcriture = await lectures.lireFichePersonne(ctxResp, "ecriture", personnes.pilote)
    controle("le ressenti est servi à l'équipage (écriture)", ficheEcriture?.ressenti === 4, `${ficheEcriture?.ressenti}`)

    // 2. Droits : l'assistance ne gère que son dossier, et le pilote ne s'affecte pas.
    const refusAutre = await refuse(equipe.ajouterLicenceDans(ctxAss, personnes.cible, { type: "autre", saison: "2026" }, "contribution"))
    controle("l'assistance ne gère pas le dossier d'un autre", refusAutre?.includes("ton propre dossier") === true, refusAutre ?? "aucun refus")
    const refusPilote = await refuse(equipe.affecterPersonneDans(ctxResp, epreuves[0].id, personnes.cible, { roleEpreuve: "pilote" }))
    controle("le pilote ne s'affecte pas à une épreuve", refusPilote?.includes("se choisissent sur l'engagement") === true, refusPilote ?? "aucun refus")

    // 3. Palier : calculé sur les épreuves validées (cinq donne confirmé), jamais en baisse après une annulation.
    await equipe.modifierProfilDans(ctxResp, personnes.pilote, { afficherTrophees: false }, "ecriture")
    await liaisons.mettreAJourPalierDans(ctxResp, personnes.pilote)
    const profilAvant = await proprietaire.equipeProfile.findFirst({ where: { teamId: team.id, personId: personnes.pilote, deletedAt: null } })
    controle("cinq épreuves validées donnent le palier confirmé", profilAvant?.palier === "confirme", profilAvant?.palier)
    await proprietaire.saisonResult.updateMany({ where: { teamId: team.id, entryId: entrees[0].id }, data: { validation: "saisi" } })
    await liaisons.mettreAJourPalierDans(ctxResp, personnes.pilote)
    const profilApres = await proprietaire.equipeProfile.findFirst({ where: { teamId: team.id, personId: personnes.pilote, deletedAt: null } })
    controle("une annulation de résultat ne fait pas descendre le palier", profilApres?.palier === "confirme", profilApres?.palier)

    // 4. Échéance : une licence qui expire dans dix jours émet un événement une seule fois, même relancée.
    const dansDix = jourDans(10)
    const licence = await equipe.ajouterLicenceDans(ctxResp, personnes.cible, { type: "ffsa_regionale", saison: "2026", valableAu: dansDix.texte }, "gestion")
    await equipe.recalculerEcheancesDans(ctxResp)
    await equipe.recalculerEcheancesDans(ctxResp)
    const emis = await proprietaire.coreDomainEvent.count({ where: { teamId: team.id, nom: "equipe.licence_expire_bientot" } })
    controle("une échéance de licence est émise une seule fois", emis === 1, `${emis}`)
    const actions = await proprietaire.coreAction.count({ where: { teamId: team.id, cleUnicite: `licence:${licence}:${dansDix.texte}` } })
    controle("l'action « Renouveler » existe une seule fois", actions === 1, `${actions}`)

    // 5. Écritures : la licence payée garde son montant et la validité incohérente est refusée.
    const refusValidite = await refuse(
      equipe.ajouterLicenceDans(ctxResp, personnes.cible, { type: "autre", saison: "2026", valableDu: "2026-06-01", valableAu: "2026-05-01" }, "gestion"),
    )
    controle("une fin de validité avant le début est refusée", refusValidite?.includes("avant le début") === true, refusValidite ?? "aucun refus")
    const ligneLicence = await proprietaire.equipeLicence.findFirst({ where: { id: licence } })
    controle("la licence est enregistrée avec son type", ligneLicence?.type === "ffsa_regionale", ligneLicence?.type)
  } finally {
    await proprietaire.equipeMood.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.equipeLicence.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.equipeProfile.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.equipeAssignment.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.equipeAvailability.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAction.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.saisonResult.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEventEntry.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreSeason.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreVehicle.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: { in: equipes } } })
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
    console.log("\nÉquipe vérifiée : tous les contrôles passent.")
    process.exit(0)
  })
  .catch((erreur) => {
    console.error(`\n${erreur instanceof Error ? erreur.message : erreur}`)
    process.exit(1)
  })
