// Vérifie Documents contre la base réelle (tâche 5.3, brief §6).
// Usage : pnpm db:verifier-documents
//
// La team de test, sa seconde team et leurs responsables sont créés avec le rôle propriétaire ; les services réels
// (creerDocumentPour, ajouterVersionPour) sont appelés avec le rôle applicatif, sans session. Tout est supprimé dans un
// finally. Une ligne par contrôle ; exit 1 au premier écart.
//
// Contrôles : une team ne voit ni n'écrit chez une autre (RLS) ; contraintes (dates, numéro de version, unicité de la
// version, nom d'un dossier type) ; les sept dossiers types créés une seule fois sous deux écritures simultanées ; une
// nouvelle version ne remplace pas l'ancienne, et le rattachement du fichier pointe la version ; le lien public ne
// renvoie que les liens valides (révoqué, expiré, document archivé : rien), et le rôle applicatif sans team ne lit pas
// documents_share.

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

class EcartDocuments extends Error {}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartDocuments(`${libelle}${detail ? ` (${detail})` : ""}`)
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
  const services = await import("../src/apps/documents/services-serveur")
  const regles = await import("../src/apps/documents/regles")
  const { prismaPourTeam } = await import("../src/lib/prisma")

  const suffixe = randomUUID().slice(0, 8)
  const teamA = { id: randomUUID(), nom: `Verif documents ${suffixe}`, slug: `verif-documents-${suffixe}` }
  const teamB = { id: randomUUID(), nom: `Verif documents B ${suffixe}`, slug: `verif-documents-b-${suffixe}` }
  const respA = { user: randomUUID(), adhesion: randomUUID(), personne: randomUUID(), email: `verif-documents-a-${suffixe}@exemple.invalid` }
  const respB = { user: randomUUID(), adhesion: randomUUID(), personne: randomUUID(), email: `verif-documents-b-${suffixe}@exemple.invalid` }
  const ctxA = { teamId: teamA.id, userId: respA.user, membership: { id: respA.adhesion, role: "responsable" as const } }
  const ctxB = { teamId: teamB.id, userId: respB.user, membership: { id: respB.adhesion, role: "responsable" as const } }
  const equipes = [teamA.id, teamB.id]
  const clientA = () => prismaPourTeam(teamA.id, respA.user)
  const clientB = () => prismaPourTeam(teamB.id, respB.user)

  try {
    await proprietaire.coreTeam.createMany({ data: [{ id: teamA.id, nom: teamA.nom, slug: teamA.slug }, { id: teamB.id, nom: teamB.nom, slug: teamB.slug }] })
    await proprietaire.coreUser.createMany({ data: [{ id: respA.user, email: respA.email }, { id: respB.user, email: respB.email }] })
    await proprietaire.corePerson.createMany({
      data: [
        { id: respA.personne, teamId: teamA.id, nom: "Responsable", prenom: `A ${suffixe}` },
        { id: respB.personne, teamId: teamB.id, nom: "Responsable", prenom: `B ${suffixe}` },
      ],
    })
    await proprietaire.coreMembership.createMany({
      data: [
        { id: respA.adhesion, teamId: teamA.id, userId: respA.user, role: "responsable", statut: "actif", personId: respA.personne },
        { id: respB.adhesion, teamId: teamB.id, userId: respB.user, role: "responsable", statut: "actif", personId: respB.personne },
      ],
    })

    // Deux fichiers envoyés par le responsable de la team A (le rattachement exige que l'envoyeur soit le même).
    const fichier1 = randomUUID()
    const fichier2 = randomUUID()
    await proprietaire.coreFile.createMany({
      data: [fichier1, fichier2].map((id, index) => ({
        id,
        teamId: teamA.id,
        storageKey: `verif/${id}`,
        nom: `statuts-${index + 1}.pdf`,
        mimeType: "application/pdf",
        taille: 10,
        empreinte: "0".repeat(64),
        createdBy: respA.user,
        updatedBy: respA.user,
      })),
    })

    // 1. Dossiers types : deux écritures simultanées dans une team neuve créent les sept dossiers, une seule fois chacun.
    const [premier, second] = await Promise.all([
      services.creerDocumentPour(ctxA, "gestion", { titre: "Statuts 2026", typeDocument: "statuts", dossier: "association" }),
      services.creerDocumentPour(ctxA, "gestion", { titre: "Récépissé RNA", typeDocument: "recepisse_rna", dossier: "association" }),
    ])
    const systemes = await clientA().documentsFolder.findMany({ where: { teamId: teamA.id, kind: "systeme", deletedAt: null }, select: { id: true, name: true } })
    const nomsDistincts = new Set(systemes.map((dossier) => dossier.name))
    controle(
      "les sept dossiers types existent une seule fois après deux écritures simultanées",
      systemes.length === regles.DOSSIERS_TYPES.length && nomsDistincts.size === regles.DOSSIERS_TYPES.length,
      `${systemes.length} lignes, ${nomsDistincts.size} noms`,
    )
    const associations = systemes.find((dossier) => dossier.name === "Association")
    const rangements = await clientA().documentsDoc.findMany({ where: { id: { in: [premier, second] } }, select: { folderId: true } })
    controle(
      "les deux documents sont rangés dans le dossier type Association",
      associations !== undefined && rangements.length === 2 && rangements.every((doc) => doc.folderId === associations.id),
    )

    // 2. Sans fichier, un document n'a ni version ni version en cours : « Aucun fichier » est l'état réel.
    const sansFichier = await clientA().documentsDoc.findUnique({ where: { id: premier }, select: { currentVersionId: true } })
    const versionsSansFichier = await clientA().documentsVersion.count({ where: { docId: premier } })
    controle("un document sans fichier n'a ni version ni version en cours", sansFichier?.currentVersionId === null && versionsSansFichier === 0, `${versionsSansFichier}`)

    // 3. Nouvelle version : l'ancienne reste, la version en cours change, le rattachement pointe la version.
    const docId = await services.creerDocumentPour(ctxA, "gestion", {
      titre: "Statuts versionnés",
      typeDocument: "statuts",
      dossier: "association",
      fichierId: fichier1,
    })
    const premiereVersion = await clientA().documentsVersion.findFirst({ where: { docId }, select: { id: true, versionNo: true } })
    controle("un document créé avec un fichier a sa version 1", premiereVersion?.versionNo === 1)
    const nouvelleVersion = await services.ajouterVersionPour(ctxA, "gestion", docId, fichier2, "Mise à jour")
    const versions = await clientA().documentsVersion.findMany({ where: { docId }, orderBy: { versionNo: "asc" }, select: { id: true, versionNo: true, attachmentId: true } })
    controle(
      "une nouvelle version s'ajoute et l'ancienne reste consultable",
      versions.length === 2 && versions[0].id === premiereVersion?.id && versions[1].id === nouvelleVersion && versions[1].versionNo === 2,
      `${versions.length} versions`,
    )
    const doc = await clientA().documentsDoc.findUnique({ where: { id: docId }, select: { currentVersionId: true } })
    controle("la version en cours est la nouvelle", doc?.currentVersionId === nouvelleVersion)
    const rattachement = await clientA().coreAttachment.findFirst({ where: { id: versions[1].attachmentId }, select: { ficheType: true, ficheId: true, fileId: true } })
    controle(
      "le rattachement de la version pointe la version et son fichier",
      rattachement?.ficheType === "documents_version" && rattachement.ficheId === nouvelleVersion && rattachement.fileId === fichier2,
      rattachement?.ficheId ?? "aucun rattachement",
    )

    // 4. Cloisonnement : la team B ne voit pas les documents de la team A, et n'écrit pas chez elle.
    const vusParB = await clientB().documentsDoc.findMany({ where: { id: { in: [premier, second, docId] } }, select: { id: true } })
    controle("une team ne voit pas les documents d'une autre", vusParB.length === 0, `${vusParB.length} vus`)
    const ecritureChezA = await refuse(
      clientB().documentsFolder.create({
        data: { id: randomUUID(), teamId: teamA.id, name: "Intrus", kind: "perso", visibility: "team", createdBy: respB.user, updatedBy: respB.user },
      }),
    )
    controle("une team n'écrit pas chez une autre (RLS à l'écriture)", ecritureChezA !== null, ecritureChezA ?? "écriture acceptée")

    // 5. Contraintes de la base : une date de validité avant l'émission, un numéro de version nul ou déjà pris, un
    // second dossier type du même nom, un effectif négatif sont refusés.
    const dossierAssociation = associations?.id ?? ""
    const validiteAvant = await refuse(
      clientA().documentsDoc.create({
        data: {
          id: randomUUID(),
          teamId: teamA.id,
          folderId: dossierAssociation,
          title: "Validité avant émission",
          docType: "statuts",
          status: "actif",
          visibility: "team",
          issuedOn: new Date("2026-06-01T00:00:00Z"),
          validUntil: new Date("2026-05-01T00:00:00Z"),
          createdBy: respA.user,
          updatedBy: respA.user,
        },
      }),
    )
    controle("une validité avant l'émission est refusée par la base", validiteAvant !== null, validiteAvant ?? "accepté")

    const numeroNul = await refuse(
      clientA().documentsVersion.create({
        data: { id: randomUUID(), teamId: teamA.id, docId, versionNo: 0, attachmentId: versions[0].attachmentId, createdBy: respA.user, updatedBy: respA.user },
      }),
    )
    controle("un numéro de version nul est refusé", numeroNul !== null, numeroNul ?? "accepté")

    const numeroPris = await refuse(
      clientA().documentsVersion.create({
        data: { id: randomUUID(), teamId: teamA.id, docId, versionNo: 1, attachmentId: versions[0].attachmentId, createdBy: respA.user, updatedBy: respA.user },
      }),
    )
    controle("deux versions ne portent pas le même numéro dans un document", numeroPris !== null, numeroPris ?? "accepté")

    const dossierTypeDouble = await refuse(
      clientA().documentsFolder.create({
        data: { id: randomUUID(), teamId: teamA.id, name: "Association", kind: "systeme", visibility: "team", createdBy: respA.user, updatedBy: respA.user },
      }),
    )
    controle("un second dossier type du même nom est refusé", dossierTypeDouble !== null, dossierTypeDouble ?? "accepté")

    const effectifNegatif = await refuse(
      clientA().documentsFolder.create({
        data: { id: randomUUID(), teamId: teamA.id, name: "Effectif négatif", kind: "perso", visibility: "team", expectedCount: -1, createdBy: respA.user, updatedBy: respA.user },
      }),
    )
    controle("un effectif attendu négatif est refusé", effectifNegatif !== null, effectifNegatif ?? "accepté")

    // 6. Lien public (migration documents_lien_par_empreinte, brief 5.4 §2) : seul un lien valide renvoie sa team, son
    // document et rien d'autre. Un lien révoqué, expiré, sur un document archivé ou inconnu ne renvoie rien. Le rôle
    // applicatif, sans contexte de team, ne lit pas documents_share.
    const { createHash, randomBytes } = await import("node:crypto")
    const { prisma } = await import("../src/lib/prisma")
    const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex")
    const jour = 86_400_000
    const docArchive = randomUUID()
    await clientA().documentsDoc.create({
      data: { id: docArchive, teamId: teamA.id, folderId: dossierAssociation, title: "Document archivé", docType: "statuts", status: "archive", visibility: "team", createdBy: respA.user, updatedBy: respA.user },
    })
    const jetons = { valide: randomBytes(32).toString("base64url"), revoque: randomBytes(32).toString("base64url"), expire: randomBytes(32).toString("base64url"), archive: randomBytes(32).toString("base64url") }
    const creerLien = (jeton: string, cible: string, expiresAt: Date, revokedAt: Date | null) =>
      proprietaire.documentsShare.create({
        data: { id: randomUUID(), teamId: teamA.id, docId: cible, tokenHash: empreinte(jeton), expiresAt, revokedAt, createdBy: respA.user, updatedBy: respA.user },
      })
    const dans7Jours = new Date(Date.now() + 7 * jour)
    await creerLien(jetons.valide, docId, dans7Jours, null)
    await creerLien(jetons.revoque, docId, dans7Jours, new Date())
    await creerLien(jetons.expire, docId, new Date(Date.now() - jour), null)
    await creerLien(jetons.archive, docArchive, dans7Jours, null)
    const trouver = (jeton: string) =>
      prisma.$queryRaw<{ share_id: string; team_id: string; doc_id: string }[]>`SELECT share_id, team_id, doc_id FROM documents_lien_par_empreinte(${empreinte(jeton)})`

    const valide = await trouver(jetons.valide)
    controle(
      "un lien valide renvoie sa team et son document, et rien d'autre",
      valide.length === 1 && valide[0].team_id === teamA.id && valide[0].doc_id === docId && Object.keys(valide[0]).length === 3,
      `${valide.length} ligne(s)`,
    )
    controle("un lien révoqué ne renvoie rien", (await trouver(jetons.revoque)).length === 0)
    controle("un lien expiré ne renvoie rien", (await trouver(jetons.expire)).length === 0)
    controle("un lien sur un document archivé ne renvoie rien", (await trouver(jetons.archive)).length === 0)
    controle("un jeton inconnu ne renvoie rien", (await trouver(randomBytes(32).toString("base64url"))).length === 0)

    // Lecture directe sans contexte de team : la RLS ne laisse rien passer (ou la lecture échoue : les deux comptent).
    const lectureSansTeam = await prisma.documentsShare.findMany({ where: { teamId: teamA.id }, select: { id: true } }).catch(() => [])
    controle("le rôle applicatif sans contexte de team ne lit pas documents_share", lectureSansTeam.length === 0, `${lectureSansTeam.length} ligne(s)`)
  } finally {
    // Ordre des suppressions : les liens RESTRICT d'abord (version en cours, versions, liens, documents, dossiers, rattachements, fichiers).
    await proprietaire.documentsDoc.updateMany({ where: { teamId: { in: equipes } }, data: { currentVersionId: null } })
    await proprietaire.documentsVersion.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.documentsShareLog.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.documentsShare.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.documentsAccess.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.documentsDeadline.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.documentsDoc.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.documentsFolder.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreAttachment.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreFile.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreDomainEvent.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreMembership.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.corePerson.deleteMany({ where: { teamId: { in: equipes } } })
    await proprietaire.coreUser.deleteMany({ where: { email: { endsWith: `-${suffixe}@exemple.invalid` } } })
    await proprietaire.coreTeam.deleteMany({ where: { id: { in: equipes } } })
    await proprietaire.$disconnect()
  }
}

main()
  .then(() => {
    console.log("\nDocuments vérifié : tous les contrôles passent.")
    process.exit(0)
  })
  .catch((erreur) => {
    console.error(`\n${erreur instanceof Error ? erreur.message : erreur}`)
    process.exit(1)
  })
