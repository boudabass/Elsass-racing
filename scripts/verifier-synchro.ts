// Vérification en base de la synchro hors ligne : deux appareils simulés sur une team de test.
// A (responsable) et B (assistance). Contrôles : création et tirage, conflit de modification
// journalisé, rejeu idempotent, table hors liste blanche refusée, isolement entre teams (RLS).
// Nettoyage final dans un finally. Usage : pnpm db:verifier-synchro

import "./lib/env"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { newId } from "../src/core/ids"
import { appliquerOperations } from "../src/core/synchro/pousser"
import { tirerPaquets } from "../src/core/synchro/tirer"
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
  } finally {
    await nettoyer([teamId, teamAutreId], [respUserId, assUserId, eqUserId], [devA, devB])
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
