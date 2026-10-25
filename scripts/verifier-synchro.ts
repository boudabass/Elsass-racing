// Vérification en base de la synchro hors ligne : deux appareils simulés sur une team de test.
// A (responsable) et B (assistance). Contrôles : création et tirage, conflit de modification
// journalisé, rejeu idempotent, table hors liste blanche refusée, isolement entre teams (RLS).
// Nettoyage final dans un finally. Usage : pnpm db:verifier-synchro

import "./lib/env"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { newId } from "../src/core/ids"
import { appliquerOperations } from "../src/core/synchro/pousser"
import { declarationDe } from "../src/core/synchro/registre"
import { memoriserSynchro, tirerPaquets } from "../src/core/synchro/tirer"
import { ErreurAppareilRevoque } from "../src/core/synchro/erreurs"
import { reponseErreurAcces } from "../src/core/synchro/reponses"
import { executerPourTeam } from "../src/lib/prisma"
import type { ContexteTeam } from "../src/core/contexte"
import type { Operation, ResultatOperation } from "../src/core/synchro/protocole"

const url = process.env.DATABASE_URL_MIGRATION
if (!url) {
  console.error("DATABASE_URL_MIGRATION absente.")
  process.exit(1)
}
const bd = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const resultats: Array<{ libelle: string; ok: boolean }> = []
function controle(libelle: string, ok: boolean): void {
  resultats.push({ libelle, ok })
  console.log(`${ok ? "OK " : "KO "}  ${libelle}`)
}

function operation(partial: Omit<Operation, "idOperation">): Operation {
  return { idOperation: newId(), ...partial }
}

async function nettoyer(teamIds: string[], userIds: string[], deviceIds: string[]): Promise<void> {
  await bd.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica")
    const tables = await tx.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name::text AS table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'team_id'`
    for (const { table_name } of tables) {
      await tx.$executeRawUnsafe(`DELETE FROM "${table_name}" WHERE team_id = ANY($1::uuid[])`, teamIds)
    }
    await tx.$executeRawUnsafe("DELETE FROM core_team WHERE id = ANY($1::uuid[])", teamIds)
    await tx.$executeRawUnsafe("DELETE FROM core_device WHERE id = ANY($1::uuid[])", deviceIds)
    await tx.$executeRawUnsafe("DELETE FROM core_user WHERE id = ANY($1::uuid[])", userIds)
  })
}

async function main(): Promise<void> {
  const horodatage = Date.now().toString(36)
  const teamId = newId()
  const teamAutreId = newId()
  const respUserId = newId()
  const assUserId = newId()
  const respMemId = newId()
  const assMemId = newId()
  const eqUserId = newId()
  const eqMemId = newId()
  const devA = newId()
  const devB = newId()
  const inviteUserId = newId()
  const inviteMemId = newId()

  await bd.coreTeam.create({ data: { id: teamId, nom: `Synchro ${horodatage}`, slug: `synchro-${horodatage}`, statut: "active" } })
  await bd.coreTeam.create({ data: { id: teamAutreId, nom: `Synchro autre ${horodatage}`, slug: `synchro-autre-${horodatage}`, statut: "active" } })
  await bd.coreUser.create({ data: { id: respUserId, email: `synchro-resp-${horodatage}@example.test` } })
  await bd.coreUser.create({ data: { id: assUserId, email: `synchro-ass-${horodatage}@example.test` } })
  await bd.coreMembership.create({ data: { id: respMemId, teamId, userId: respUserId, role: "responsable", statut: "actif" } })
  await bd.coreMembership.create({ data: { id: assMemId, teamId, userId: assUserId, role: "assistance", statut: "actif" } })
  await bd.coreUser.create({ data: { id: eqUserId, email: `synchro-eq-${horodatage}@example.test` } })
  await bd.coreMembership.create({ data: { id: eqMemId, teamId, userId: eqUserId, role: "equipage", statut: "actif" } })
  await bd.coreDevice.create({ data: { id: devA, userId: respUserId, nom: "Appareil A", plateforme: "essai" } })
  await bd.coreDevice.create({ data: { id: devB, userId: assUserId, nom: "Appareil B", plateforme: "essai" } })

  const ctxA: ContexteTeam = { teamId, userId: respUserId, membership: { id: respMemId, role: "responsable" } }
  const ctxB: ContexteTeam = { teamId, userId: assUserId, membership: { id: assMemId, role: "assistance" } }
  const ctxAutre: ContexteTeam = { teamId: teamAutreId, userId: respUserId, membership: { id: respMemId, role: "responsable" } }
  const ctxEquipage: ContexteTeam = { teamId, userId: eqUserId, membership: { id: eqMemId, role: "equipage" } }

  try {
    // 1. B (assistance) crée une note hors ligne ; A (responsable) la tire.
    const idNote = newId()
    const creation = await appliquerOperations(ctxB, devB, [
      operation({ table: "core_note", type: "creer", id: idNote, champs: { texte: "Bâche à récupérer au parc" } }),
    ])
    controle("B crée une note : appliquée", creation[0]?.statut === "appliquee")

    const tirageA = await tirerPaquets(ctxA, {})
    const lignesA = tirageA.tables["core_note"]?.lignes ?? []
    controle("A tire et voit la note", lignesA.some((l) => l.id === idNote && l.texte === "Bâche à récupérer au parc"))

    // 1 bis. Périmètre de lecture (article 948 : au niveau contribution, on ne voit que ce qu'on a créé).
    // A (responsable) crée une note que l'assistance ne doit pas voir.
    const idNoteA = newId()
    await appliquerOperations(ctxA, devA, [operation({ table: "core_note", type: "creer", id: idNoteA, champs: { texte: "Note du responsable seul" } })])
    const tirageBPerimetre = await tirerPaquets(ctxB, {})
    const lignesBPerimetre = tirageBPerimetre.tables["core_note"]?.lignes ?? []
    controle("l'assistance ne tire que ses propres notes", lignesBPerimetre.length > 0 && lignesBPerimetre.every((l) => l.createdBy === assUserId))
    controle("l'assistance ne reçoit pas la note du responsable", !lignesBPerimetre.some((l) => l.id === idNoteA))
    const tirageEquipage = await tirerPaquets(ctxEquipage, {})
    const lignesEquipage = tirageEquipage.tables["core_note"]?.lignes ?? []
    controle("l'équipage tire toutes les notes de la team", lignesEquipage.some((l) => l.id === idNote) && lignesEquipage.some((l) => l.id === idNoteA))

    // 2. A (responsable) modifie la note avec la rev lue (1) ; B la modifie ensuite avec la même rev
    // lue : la seconde gagne, et la version écrasée est journalisée.
    const idOpA = newId()
    const modifA = await appliquerOperations(ctxA, devA, [
      { idOperation: idOpA, table: "core_note", type: "modifier", id: idNote, revLue: 1, champs: { texte: "Bâche : récupérée" } },
    ])
    controle("A modifie avec la rev lue : appliquée", modifA[0]?.statut === "appliquee")

    const modifB = await appliquerOperations(ctxB, devB, [
      operation({ table: "core_note", type: "modifier", id: idNote, revLue: 1, champs: { texte: "Bâche : à faire" } }),
    ])
    controle("B modifie avec une rev dépassée : conflit résolu, la seconde gagne", modifB[0]?.statut === "conflit_resolu")

    const noteFinale = await bd.coreNote.findUnique({ where: { id: idNote }, select: { texte: true, rev: true } })
    controle("la version de B est celle en base", noteFinale?.texte === "Bâche : à faire" && noteFinale.rev === 3)

    const journal = await bd.coreActivity.findMany({ where: { teamId, action: "conflit_synchro", ficheId: idNote } })
    controle("le conflit est journalisé avec la version écrasée", journal.length === 1 && JSON.stringify(journal[0]?.resume).includes("Bâche : récupérée"))

    // 3. Rejouer l'opération de A avec le même idOperation n'applique rien.
    const revAvant = (await bd.coreNote.findUnique({ where: { id: idNote }, select: { rev: true } }))?.rev
    const rejeu: ResultatOperation[] = await appliquerOperations(ctxA, devA, [
      { idOperation: idOpA, table: "core_note", type: "modifier", id: idNote, revLue: 1, champs: { texte: "REJOUÉ" } },
    ])
    const revApres = (await bd.coreNote.findUnique({ where: { id: idNote }, select: { rev: true, texte: true } }))
    controle("rejouer le même idOperation renvoie le résultat noté", rejeu[0]?.statut === "appliquee")
    controle("rejouer le même idOperation n'applique rien", revApres?.rev === revAvant && revApres?.texte === "Bâche : à faire")

    // 4. Table hors liste blanche : refusée.
    const horsListe = await appliquerOperations(ctxA, devA, [
      operation({ table: "core_action", type: "creer", id: newId(), champs: {} }),
    ])
    controle("une table hors liste blanche est refusée", horsListe[0]?.statut === "refusee")

    // 5. Une écriture vers une autre team est refusée (la note n'existe pas dans cette team).
    const autreTeam = await appliquerOperations(ctxAutre, devA, [
      operation({ table: "core_note", type: "supprimer", id: idNote, revLue: 3 }),
    ])
    controle("une écriture vers une autre team est refusée", autreTeam[0]?.statut === "refusee")

    // 6. Le RLS isole les lectures : une lecture dans l'autre team ne voit pas la note.
    const vueAutre = await executerPourTeam(teamAutreId, respUserId, (tx) => tx.coreNote.findMany({ where: { id: idNote } }))
    controle("le RLS cache la note à l'autre team", vueAutre.length === 0)

    // 7. Le contrôle de contribution : l'assistance ne modifie pas la note d'un autre.
    const idNoteRespo = newId()
    await appliquerOperations(ctxA, devA, [operation({ table: "core_note", type: "creer", id: idNoteRespo, champs: { texte: "Note du responsable" } })])
    const refusContribution = await appliquerOperations(ctxB, devB, [
      operation({ table: "core_note", type: "modifier", id: idNoteRespo, revLue: 1, champs: { texte: "Modif de B" } }),
    ])
    controle("l'assistance ne modifie pas la note d'un autre", refusContribution[0]?.statut === "refusee")
    // 8. Appareil révoqué pendant une synchro : le curseur et l'appareil disparaissent entre deux
    // tirages. La mémorisation ne lève pas d'erreur brute : elle signale un appareil déconnecté, et la
    // route répond 401, sans journal d'erreur.
    const devC = newId()
    await bd.coreDevice.create({ data: { id: devC, userId: assUserId, nom: "Appareil C", plateforme: "essai" } })
    const tirageC = await tirerPaquets(ctxB, {})
    await memoriserSynchro(ctxB, devC, tirageC.tables)
    await bd.coreSyncCursor.deleteMany({ where: { deviceId: devC } })
    await bd.coreDevice.delete({ where: { id: devC } })
    let signale: unknown = null
    const erreurs: unknown[] = []
    const erreurOriginale = console.error
    console.error = (...args: unknown[]) => erreurs.push(args)
    try {
      await memoriserSynchro(ctxB, devC, tirageC.tables)
    } catch (erreur) {
      signale = erreur
    } finally {
      console.error = erreurOriginale
    }
    const reponse = signale instanceof ErreurAppareilRevoque ? reponseErreurAcces(signale) : null
    controle("un appareil supprimé pendant la synchro est signalé comme déconnecté", signale instanceof ErreurAppareilRevoque)
    controle("la route répond 401 « Cet appareil a été déconnecté. »", reponse?.status === 401)
    controle("aucune erreur n'est journalisée côté serveur", erreurs.length === 0)

    // 9. Curseur seul disparu : il est recréé, l'appareil reste connecté.
    const devD = newId()
    await bd.coreDevice.create({ data: { id: devD, userId: assUserId, nom: "Appareil D", plateforme: "essai" } })
    await memoriserSynchro(ctxB, devD, tirageC.tables)
    await bd.coreSyncCursor.deleteMany({ where: { deviceId: devD } })
    await memoriserSynchro(ctxB, devD, tirageC.tables)
    const recree = await bd.coreSyncCursor.count({ where: { deviceId: devD } })
    controle("un curseur disparu est recréé pour un appareil encore connecté", recree === 1)
    await bd.coreDevice.delete({ where: { id: devD } })

    // 12. Saison hors ligne (article 949, section 9) : lecture seule, écriture par contribution propre, débrief privé.
    controle(
      "le registre déclare les tables de Saison hors ligne",
      ["core_event", "saison_stage", "saison_schedule_item", "saison_recce", "saison_recce_session", "saison_debrief"].every((cle) => declarationDe(cle) !== undefined),
    )
    const saisonSync = newId()
    await bd.coreSeason.create({
      data: { id: saisonSync, teamId, annee: 2032, nom: "Saison synchro", dateDebut: new Date("2032-01-01"), dateFin: new Date("2032-12-31"), enCours: true },
    })
    const epreuveSync = newId()
    await bd.coreEvent.create({
      data: { id: epreuveSync, teamId, seasonId: saisonSync, type: "rallye", nom: "Rallye synchro", dateDebut: new Date("2032-06-01"), dateFin: new Date("2032-06-02") },
    })
    const recceSync = newId()
    await bd.saisonRecce.create({ data: { id: recceSync, teamId, eventId: epreuveSync } })
    const vehiculeSync = newId()
    await bd.coreVehicle.create({ data: { id: vehiculeSync, teamId, type: "course", nomCourt: "Voiture synchro" } })
    const entreeSync = newId()
    await bd.coreEventEntry.create({ data: { id: entreeSync, teamId, eventId: epreuveSync, vehicleId: vehiculeSync, statut: "arrivee" } })

    const refusLectureSeule = await appliquerOperations(ctxA, devA, [
      operation({ table: "saison_stage", type: "modifier", id: newId(), revLue: 1, champs: { nom: "Écrit depuis l'appareil" } }),
    ])
    controle(
      "une table de Saison en lecture seule refuse toute écriture depuis l'appareil",
      refusLectureSeule[0]?.statut === "refusee" && (refusLectureSeule[0]?.raison ?? "").includes("se lit seulement"),
    )

    const idSortie = newId()
    const creationSortie = await appliquerOperations(ctxEquipage, devA, [
      operation({ table: "saison_recce_session", type: "creer", id: idSortie, champs: { recceId: recceSync, date: "2032-06-01", personnes: [], speciales: [], passages: 2, notes: "Reco test" } }),
    ])
    controle("l'équipage écrit une sortie de reco hors ligne : appliquée", creationSortie[0]?.statut === "appliquee")
    const sortieBase = await bd.saisonRecceSession.findUnique({ where: { id: idSortie }, select: { createdBy: true, passages: true } })
    controle("la sortie est en base, à l'auteur de la synchro", sortieBase?.createdBy === eqUserId && sortieBase?.passages === 2)

    const sortieAssistance = await appliquerOperations(ctxB, devB, [
      operation({ table: "saison_recce_session", type: "creer", id: newId(), champs: { recceId: recceSync, date: "2032-06-01", personnes: [], speciales: [], passages: null, notes: null } }),
    ])
    controle("l'assistance ne peut pas écrire de sortie de reco", sortieAssistance[0]?.statut === "refusee")

    const idDebrief = newId()
    const debriefEquipage = await appliquerOperations(ctxEquipage, devA, [
      operation({
        table: "saison_debrief",
        type: "creer",
        id: idDebrief,
        champs: { entryId: entreeSync, ressenti: 4, pointsPositifs: "Bon départ", pointsAAmeliorer: null, problemesVoiture: null },
      }),
    ])
    controle("l'équipage écrit son débrief hors ligne : appliqué", debriefEquipage[0]?.statut === "appliquee")
    const tirageAssistance = await tirerPaquets(ctxB, {})
    controle("l'assistance ne reçoit jamais les débriefs", (tirageAssistance.tables["saison_debrief"]?.lignes ?? []).length === 0)
    const tirageEquipageDebrief = await tirerPaquets(ctxEquipage, {})
    controle("l'équipage reçoit le débrief", (tirageEquipageDebrief.tables["saison_debrief"]?.lignes ?? []).some((ligne) => ligne.id === idDebrief))
    const evenementsDebrief = await bd.coreDomainEvent.count({
      where: { teamId: ctxEquipage.teamId, nom: "saison.debrief_saisi", donnees: { path: ["entryId"], equals: entreeSync } },
    })
    controle("le débrief hors ligne émet son événement, une seule fois", evenementsDebrief === 1)

    await bd.coreSeason.update({ where: { id: saisonSync }, data: { clotureeAt: new Date(), enCours: false } })
    const apresCloture = await appliquerOperations(ctxEquipage, devA, [
      operation({ table: "saison_recce_session", type: "creer", id: newId(), champs: { recceId: recceSync, date: "2032-06-02", personnes: [], speciales: [], passages: null, notes: null } }),
    ])
    controle("une saison clôturée n'accepte plus de sortie hors ligne", apresCloture[0]?.statut === "refusee" && /clôturée/.test(apresCloture[0]?.raison ?? ""))

    // Budget hors ligne (tâche 2.7, section 0) : l'équipier saisit, modifie et supprime sa dépense par la même
    // synchro ; il ne saisit pas la dépense payée par la caisse ; chaque création émet ses événements une fois.
    const budgetServices = await import("../src/apps/budget/services-serveur")
    await budgetServices.initialiserBudgetDans(ctxA)
    const personneEquipier = newId()
    await bd.corePerson.create({ data: { id: personneEquipier, teamId, nom: "Equipier", prenom: "Synchro" } })
    await bd.coreMembership.update({ where: { id: eqMemId }, data: { personId: personneEquipier } })
    await budgetServices.initialiserBudgetDans(ctxA)
    const categorieRepas = await bd.budgetCategory.findFirst({ where: { teamId, nom: "Repas", sens: "depense" }, select: { id: true } })
    const payeurEquipier = await bd.budgetPayer.findFirst({ where: { teamId, personId: personneEquipier }, select: { id: true } })
    const caisse = await bd.budgetPayer.findFirst({ where: { teamId, type: "caisse_team" }, select: { id: true } })
    const idDepenseHL = newId()
    const champsDepense = { date: "2032-06-03", montant: 1200, categoryId: categorieRepas?.id ?? "", libelle: "Repas synchro", payerId: payeurEquipier?.id ?? "", eventId: null, moyen: null }
    const creationHL = await appliquerOperations(ctxEquipage, devA, [operation({ table: "budget_expense", type: "creer", id: idDepenseHL, champs: champsDepense })])
    const depenseHL = await bd.budgetExpense.findUnique({ where: { id: idDepenseHL } })
    controle("l'équipier saisit une dépense hors ligne : appliquée, confirmée, à rembourser", creationHL[0]?.statut === "appliquee" && depenseHL?.confirmee === true && depenseHL?.aRembourser === true)
    // L'assistance (contribution) ne saisit que ce qu'elle paie elle-même : la caisse est refusée. (L'équipage,
    // qui a l'écriture, peut payer avec la caisse.)
    const refusCaisse = await appliquerOperations(ctxB, devB, [operation({ table: "budget_expense", type: "creer", id: newId(), champs: { ...champsDepense, payerId: caisse?.id ?? "" } })])
    controle("l'assistance ne saisit pas une dépense payée par la caisse", refusCaisse[0]?.statut === "refusee" && /toi-même/.test(refusCaisse[0]?.raison ?? ""))
    const evenementsCreation = await bd.coreDomainEvent.count({ where: { teamId, nom: "budget.depense_creee" } })
    controle("la création hors ligne émet budget.depense_creee une seule fois", evenementsCreation === 1)

    const revAvantModif = (await bd.budgetExpense.findUnique({ where: { id: idDepenseHL } }))?.rev ?? 1
    const modifHL = await appliquerOperations(ctxEquipage, devA, [operation({ table: "budget_expense", type: "modifier", id: idDepenseHL, revLue: revAvantModif, champs: { ...champsDepense, montant: 1500 } })])
    controle("la modification hors ligne est appliquée", modifHL[0]?.statut === "appliquee" && (await bd.budgetExpense.findUnique({ where: { id: idDepenseHL } }))?.montant === 1500)

    const revAvantSuppr = (await bd.budgetExpense.findUnique({ where: { id: idDepenseHL } }))?.rev ?? 1
    const supprHL = await appliquerOperations(ctxEquipage, devA, [operation({ table: "budget_expense", type: "supprimer", id: idDepenseHL, revLue: revAvantSuppr })])
    controle("la suppression hors ligne est appliquée", supprHL[0]?.statut === "appliquee" && (await bd.budgetExpense.findUnique({ where: { id: idDepenseHL } }))?.deletedAt != null)

    // Photo du ticket (tâche 3.1, brief 3.2) : rattachée à la création hors ligne, et refusée si le fichier
    // a été envoyé par une autre personne.
    const ticketEquipier = newId()
    await bd.coreFile.create({ data: { id: ticketEquipier, teamId, storageKey: `verif/${ticketEquipier}`, nom: "ticket.jpg", mimeType: "image/jpeg", taille: 10, empreinte: "0".repeat(64), createdBy: eqUserId, updatedBy: eqUserId } })
    const idDepenseTicket = newId()
    const creationTicket = await appliquerOperations(ctxEquipage, devA, [operation({ table: "budget_expense", type: "creer", id: idDepenseTicket, champs: { ...champsDepense, libelle: "Ticket synchro", justificatifFileId: ticketEquipier } })])
    const rattachementTicket = await bd.coreAttachment.findFirst({ where: { teamId, fileId: ticketEquipier, ficheType: "expense", ficheId: idDepenseTicket, role: "ticket" } })
    controle("un ticket envoyé par l'équipier est rattaché à sa dépense créée hors ligne", creationTicket[0]?.statut === "appliquee" && rattachementTicket !== null)

    const ticketAssistance = newId()
    await bd.coreFile.create({ data: { id: ticketAssistance, teamId, storageKey: `verif/${ticketAssistance}`, nom: "ticket-assistance.jpg", mimeType: "image/jpeg", taille: 10, empreinte: "0".repeat(64), createdBy: assUserId, updatedBy: assUserId } })
    const refusTicket = await appliquerOperations(ctxEquipage, devA, [operation({ table: "budget_expense", type: "creer", id: newId(), champs: { ...champsDepense, libelle: "Ticket d'un autre", justificatifFileId: ticketAssistance } })])
    controle("un ticket envoyé par une autre personne est refusé à la création hors ligne", refusTicket[0]?.statut === "refusee")

    // Périmètre du payeur, comme en ligne (correction 2.8, point 3) : au niveau contribution, l'appareil suit la
    // personne qui paie, pas le créateur de la ligne.
    const personneAssistance = newId()
    await bd.corePerson.create({ data: { id: personneAssistance, teamId, nom: "Assistance", prenom: "Synchro" } })
    await bd.coreMembership.update({ where: { id: assMemId }, data: { personId: personneAssistance } })
    await budgetServices.initialiserBudgetDans(ctxA)
    const payeurAssistance = await bd.budgetPayer.findFirst({ where: { teamId, personId: personneAssistance }, select: { id: true } })
    const lignesBudgetAssistance = async () => (await tirerPaquets(ctxB, {})).tables["budget_expense"]?.lignes ?? []

    const saisieParLeResponsable = await budgetServices.creerDepenseDans(ctxA, { montant: 2000, categoryId: categorieRepas?.id ?? "", libelle: "Payée par l'assistance", payerId: payeurAssistance?.id ?? "" })
    controle("l'assistance reçoit une dépense saisie par le responsable et payée par elle", (await lignesBudgetAssistance()).some((ligne) => ligne.id === saisieParLeResponsable))

    const idSaisieAssistance = newId()
    const creationAssistance = await appliquerOperations(ctxB, devB, [operation({ table: "budget_expense", type: "creer", id: idSaisieAssistance, champs: { ...champsDepense, montant: 800, payerId: payeurAssistance?.id ?? "" } })])
    controle("l'assistance saisit hors ligne une dépense qu'elle paie : appliquée", creationAssistance[0]?.statut === "appliquee")
    await budgetServices.modifierDepenseDans(ctxA, idSaisieAssistance, { montant: 800, categoryId: categorieRepas?.id ?? "", libelle: "Reprise par le responsable", payerId: payeurEquipier?.id ?? "", eventId: null })
    controle("l'assistance ne reçoit plus une dépense dont le payeur a changé", !(await lignesBudgetAssistance()).some((ligne) => ligne.id === idSaisieAssistance))

    const revSaisieResp = (await bd.budgetExpense.findUnique({ where: { id: saisieParLeResponsable } }))?.rev ?? 1
    const modifPayeeParElle = await appliquerOperations(ctxB, devB, [operation({ table: "budget_expense", type: "modifier", id: saisieParLeResponsable, revLue: revSaisieResp, champs: { ...champsDepense, montant: 2100, payerId: payeurAssistance?.id ?? "" } })])
    controle("l'assistance modifie hors ligne une dépense qu'elle paie, même saisie par le responsable", modifPayeeParElle[0]?.statut === "appliquee")

    // Fiches de réglage hors ligne (brief 3.3, section 7). L'assistance crée une fiche sur le véhicule de la team,
    // ne modifie pas celle du responsable, ne reçoit que les siennes, et une pression hors bornes est refusée.
    const idReglageAss = newId()
    const creationReglage = await appliquerOperations(ctxB, devB, [
      operation({ table: "voiture_setup", type: "creer", id: idReglageAss, champs: { vehicleId: vehiculeSync, date: "2032-06-04", valeurs: { pression_froid_avg: 2.1 }, remarques: "Pression relevée au parc", note: 3 } }),
    ])
    controle("l'assistance crée une fiche de réglage hors ligne : appliquée", creationReglage[0]?.statut === "appliquee")
    const ficheAss = await bd.voitureSetup.findUnique({ where: { id: idReglageAss }, select: { createdBy: true, valeurs: true, note: true } })
    controle("la fiche est en base, à l'auteur de la synchro, avec sa note", ficheAss?.createdBy === assUserId && ficheAss?.note === 3 && (ficheAss?.valeurs as Record<string, unknown>)?.pression_froid_avg === 2.1)

    const idReglageRespo = newId()
    await appliquerOperations(ctxA, devA, [
      operation({ table: "voiture_setup", type: "creer", id: idReglageRespo, champs: { vehicleId: vehiculeSync, date: "2032-06-05", valeurs: { pression_froid_avg: 2 }, remarques: "" } }),
    ])
    const modifReglageAutre = await appliquerOperations(ctxB, devB, [
      operation({ table: "voiture_setup", type: "modifier", id: idReglageRespo, revLue: 1, champs: { vehicleId: vehiculeSync, date: "2032-06-05", valeurs: { pression_froid_avg: 2.4 }, remarques: "" } }),
    ])
    controle("l'assistance ne modifie pas la fiche de réglage d'un autre", modifReglageAutre[0]?.statut === "refusee")
    const tirageReglagesAss = await tirerPaquets(ctxB, {})
    const lignesReglagesAss = tirageReglagesAss.tables["voiture_setup"]?.lignes ?? []
    controle("l'assistance ne reçoit que ses fiches de réglage", lignesReglagesAss.some((l) => l.id === idReglageAss) && !lignesReglagesAss.some((l) => l.id === idReglageRespo))

    const pressionHorsBornes = await appliquerOperations(ctxB, devB, [
      operation({ table: "voiture_setup", type: "creer", id: newId(), champs: { vehicleId: vehiculeSync, date: "2032-06-04", valeurs: { pression_froid_avg: 9 }, remarques: "" } }),
    ])
    controle("une pression hors bornes est refusée depuis l'appareil", pressionHorsBornes[0]?.statut === "refusee")

    const ecritureVehicule = await appliquerOperations(ctxA, devA, [
      operation({ table: "core_vehicle", type: "modifier", id: vehiculeSync, revLue: 1, champs: { nomCourt: "Écrit depuis l'appareil" } }),
    ])
    controle("core_vehicle se lit hors ligne seulement : écriture refusée", ecritureVehicule[0]?.statut === "refusee" && (ecritureVehicule[0]?.raison ?? "").includes("se lit seulement"))
    const tirageVehiculeA = await tirerPaquets(ctxA, {})
    controle("le responsable reçoit le véhicule hors ligne", (tirageVehiculeA.tables["core_vehicle"]?.lignes ?? []).some((l) => l.id === vehiculeSync))
    // 13. Notes de fiche hors ligne (brief 5.0) : un ordre du Garage, affecté à l'assistance (B) ; un ordre non affecté.
    const personneB = newId()
    await bd.corePerson.create({ data: { id: personneB, teamId, nom: "Synchro", prenom: "Assistance", userId: assUserId } })
    const ordreAffecte = newId()
    await bd.garageWorkOrder.create({ data: { id: ordreAffecte, teamId, vehicleId: vehiculeSync, type: "revision", titre: "Vidange synchro" } })
    await bd.garageWorkOrderPerson.create({ data: { id: newId(), teamId, workOrderId: ordreAffecte, personId: personneB } })
    const ordreLibre = newId()
    await bd.garageWorkOrder.create({ data: { id: ordreLibre, teamId, vehicleId: vehiculeSync, type: "controle", titre: "Contrôle synchro" } })

    const noteFicheId = newId()
    const noteFiche = await appliquerOperations(ctxB, devB, [
      operation({ table: "core_note", type: "creer", id: noteFicheId, champs: { app: "garage", ficheType: "ordre", ficheId: ordreAffecte, texte: "Filtre à changer" } }),
    ])
    controle("l'assistance affectée ajoute une note de fiche hors ligne : appliquée", noteFiche[0]?.statut === "appliquee")

    const noteLibre = await appliquerOperations(ctxB, devB, [
      operation({ table: "core_note", type: "creer", id: newId(), champs: { app: "garage", ficheType: "ordre", ficheId: ordreLibre, texte: "Pas la mienne" } }),
    ])
    controle("l'assistance non affectée : note de fiche refusée", noteLibre[0]?.statut === "refusee")

    const fichePasDeclaree = await appliquerOperations(ctxB, devB, [
      operation({ table: "core_note", type: "creer", id: newId(), champs: { app: "voiture", ficheType: "vehicule", ficheId: vehiculeSync, texte: "Hors liste" } }),
    ])
    controle("une fiche hors liste blanche est refusée à la poussée", fichePasDeclaree[0]?.statut === "refusee" && (fichePasDeclaree[0]?.raison ?? "").includes("ne se prennent pas hors ligne"))

    const modifAutre = await appliquerOperations(ctxA, devA, [
      operation({ table: "core_note", type: "modifier", id: noteFicheId, revLue: 1, champs: { texte: "Modifiée par le responsable" } }),
    ])
    controle("hors ligne, on ne modifie pas la note de fiche d'un autre", modifAutre[0]?.statut === "refusee")

    const tirageFiche = await tirerPaquets(ctxA, {})
    controle("le responsable reçoit la note de l'ordre", (tirageFiche.tables["core_note"]?.lignes ?? []).some((l) => l.id === noteFicheId))
    // Un invité n'a rien sur le Garage (rôle par défaut) : la note de l'ordre ne lui descend pas.
    await bd.coreUser.create({ data: { id: inviteUserId, email: `synchro-inv-${horodatage}@example.test` } })
    await bd.coreMembership.create({ data: { id: inviteMemId, teamId, userId: inviteUserId, role: "invite", statut: "actif" } })
    const ctxInvite: ContexteTeam = { teamId, userId: inviteUserId, membership: { id: inviteMemId, role: "invite" } }
    const tirageInvite = await tirerPaquets(ctxInvite, {})
    controle("un invité ne reçoit pas la note de l'ordre (pas de lecture sur le Garage)", !(tirageInvite.tables["core_note"]?.lignes ?? []).some((l) => l.id === noteFicheId))
  } finally {
    await nettoyer([teamId, teamAutreId], [respUserId, assUserId, eqUserId, inviteUserId], [devA, devB])
    console.log("Nettoyage fait.")
  }

  const echecs = resultats.filter((r) => !r.ok)
  if (echecs.length > 0) {
    console.error(`\n${echecs.length} contrôle(s) en échec.`)
    process.exitCode = 1
  } else {
    console.log("\nSynchro vérifiée : tous les contrôles passent.")
  }
}

main()
  .catch((erreur) => {
    console.error(erreur)
    process.exitCode = 1
  })
  .finally(() => bd.$disconnect())
