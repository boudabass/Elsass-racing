// Lectures de Documents (tâche 5.3, brief §4). Chaque fonction ouvre sa garde (accesDocuments) et filtre avec les règles
// de regles.ts : une lecture n'écrit jamais, et ne montre jamais un document que la personne ne voit pas. Un dossier
// type qui n'existe pas encore en base est rendu comme vide, sans id : la première écriture le crée.

import { jourDeParis } from "@/core/dates"
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { LIBELLE_TYPE_DOCUMENT } from "./libelles"
import {
  completude,
  DOSSIERS_TYPES,
  dossierTypeParCle,
  joursAvantEcheance,
  libelleAuteur,
  peutAjouterDocument,
  peutArchiverDocument,
  peutDeplacerDocument,
  peutGererDossier,
  peutModifierDocument,
  peutPartagerDocument,
  peutVoirDocument,
  peutVoirDossier,
  pireZone,
  texteEcheance,
  zoneDocument,
  type Decision,
  type NiveauAcces,
  type QuiAgit,
  type TypeDocument,
  type Visibilite,
  type Zone,
} from "./regles"
import { accesDocuments, documentPourDroits, dossierPourDroits, personneDuMembre } from "./services-serveur"

type Visible = {
  id: string
  folderId: string
  title: string
  docType: string
  validUntil: Date | null
  status: "actif" | "archive"
  visibility: Visibilite
  ownerPersonId: string | null
  createdBy: string | null
}

type DossierLigne = {
  id: string
  name: string
  kind: "systeme" | "perso"
  visibility: Visibilite
  ownerPersonId: string | null
  sort: number
  expectedCount: number | null
}

async function qui(ctx: ContexteTeam, niveau: QuiAgit["niveau"]): Promise<QuiAgit> {
  return { personId: await personneDuMembre(ctx), niveau }
}

// E-mails des comptes qui ont créé un document ou une version : le repli d'auteur quand le compte n'a pas de fiche
// personne (libelleAuteur). Ces lectures restent dans la team.
async function emailsDeComptes(ctx: ContexteTeam, ids: Array<string | null>): Promise<Map<string, string>> {
  const uniques = Array.from(new Set(ids.filter((id): id is string => id !== null)))
  if (uniques.length === 0) return new Map()
  const comptes = await prismaPourTeam(ctx.teamId, ctx.userId).coreUser.findMany({
    where: { id: { in: uniques } },
    select: { id: true, email: true },
  })
  return new Map(comptes.map((compte) => [compte.id, compte.email]))
}

// Dossier virtuel d'un type pas encore créé : visible de tous, vide.
function dossierVirtuel(nom: string): DossierLigne {
  return { id: "", name: nom, kind: "systeme", visibility: "team", ownerPersonId: null, sort: 0, expectedCount: null }
}

// Tous les dossiers et les documents de la team, avec les accès internes de la personne qui lit.
async function charger(ctx: ContexteTeam, personId: string | null) {
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [dossiers, documents, accesMoi] = await Promise.all([
    client.documentsFolder.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: { id: true, name: true, kind: true, visibility: true, ownerPersonId: true, sort: true, expectedCount: true },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
    }),
    client.documentsDoc.findMany({
      where: { teamId: ctx.teamId, deletedAt: null },
      select: { id: true, folderId: true, title: true, docType: true, validUntil: true, status: true, visibility: true, ownerPersonId: true, createdBy: true },
      orderBy: [{ validUntil: "asc" }, { title: "asc" }],
    }),
    personId
      ? client.documentsAccess.findMany({ where: { teamId: ctx.teamId, personId, deletedAt: null }, select: { docId: true, level: true } })
      : Promise.resolve([] as Array<{ docId: string; level: string }>),
  ])
  const accesParDoc = new Map(accesMoi.map((acces) => [acces.docId, acces.level as NiveauAcces]))
  const dossiersParId = new Map(dossiers.map((dossier) => [dossier.id, dossier as DossierLigne]))
  return {
    dossiers: dossiers as DossierLigne[],
    dossiersParId,
    documents: documents as Visible[],
    accesParDoc,
  }
}

// --- Coffre-fort -------------------------------------------------------------------------------

export type CarteDossier = {
  // Clé de l'URL : la clé courte d'un dossier type, ou l'identifiant d'un dossier de la team.
  param: string
  nom: string
  systeme: boolean
  // Nombre de documents actifs visibles.
  nombre: number
  jauge: { presents: number; attendus: number } | null
  zone: Zone | null
  texteZone: string
}

export type CoffreDonnees = {
  compteurs: { rouge: number; orange: number; vert: number }
  cartes: CarteDossier[]
  peutCreerDossier: Decision
  peutAjouter: Decision
  assistance: boolean
}

export async function lireCoffre(): Promise<CoffreDonnees> {
  const { ctx, niveau } = await accesDocuments("lecture")
  const acteur = await qui(ctx, niveau)
  const maintenant = new Date()
  const { dossiers, dossiersParId, documents, accesParDoc } = await charger(ctx, acteur.personId)

  // Documents que la personne voit, actifs seulement : compteurs, cartes et jauges n'en comptent pas d'autres.
  const visibles = documents.filter((doc) => {
    const dossier = dossiersParId.get(doc.folderId)
    if (!dossier) return false
    return peutVoirDocument(documentPourDroits(doc, accesParDoc.get(doc.id) ?? null), dossierPourDroits(dossier), acteur)
  })
  const actifs = visibles.filter((doc) => doc.status === "actif")

  const zones = actifs.map((doc) => zoneDocument(doc.validUntil, maintenant))
  const compteurs = {
    rouge: zones.filter((zone) => zone === "rouge").length,
    orange: zones.filter((zone) => zone === "orange").length,
    vert: zones.filter((zone) => zone === "vert").length,
  }

  // Cartes : les sept dossiers types (virtuels s'ils ne sont pas encore créés), puis les dossiers de la team. Un dossier
  // caché à la personne apparaît tout de même s'il contient un document qui lui est ouvert : la carte ne montre alors
  // que ces documents, et n'a pas de jauge (la complétude d'un dossier caché ne se calcule pas sur une partie seulement).
  const cartes: CarteDossier[] = []
  for (const type of DOSSIERS_TYPES) {
    const ligne = dossiers.find((dossier) => dossier.kind === "systeme" && dossier.name === type.nom) ?? dossierVirtuel(type.nom)
    const voit = peutVoirDossier(dossierPourDroits(ligne), acteur)
    if (!voit && !contientVisible(ligne, visibles)) continue
    cartes.push(carte(type.cle, ligne, actifs, maintenant, type.typesAttendus, true, voit))
  }
  for (const dossier of dossiers.filter((dossier) => dossier.kind === "perso")) {
    const voit = peutVoirDossier(dossierPourDroits(dossier), acteur)
    if (!voit && !contientVisible(dossier, visibles)) continue
    cartes.push(carte(dossier.id, dossier, actifs, maintenant, [], false, voit))
  }

  const assistance = acteur.niveau === "contribution"
  return {
    compteurs,
    cartes: assistance ? cartes.filter((unCarte) => unCarte.nombre > 0) : cartes,
    peutCreerDossier: peutGererDossier(acteur),
    peutAjouter: peutAjouterDocument(acteur),
    assistance,
  }
}

// Vrai si la personne voit au moins un document de ce dossier (accès interne ou propriété), même sans voir le dossier.
function contientVisible(dossier: DossierLigne, visibles: Visible[]): boolean {
  return dossier.id !== "" && visibles.some((doc) => doc.folderId === dossier.id)
}

// Carte d'un dossier. Les documents arrivent triés par échéance, la plus proche d'abord : le premier qui a une date
// donne le texte de la pastille (la pire zone du dossier). Sans voir le dossier, la carte n'a pas de jauge.
function carte(
  param: string,
  dossier: DossierLigne,
  actifs: Visible[],
  maintenant: Date,
  typesAttendus: readonly TypeDocument[],
  systeme: boolean,
  dossierVisible: boolean,
): CarteDossier {
  const docs = dossier.id === "" ? [] : actifs.filter((doc) => doc.folderId === dossier.id)
  const zone = pireZone(docs.map((doc) => zoneDocument(doc.validUntil, maintenant)))
  const plusProche = docs.find((doc) => doc.validUntil !== null)
  const jauge =
    typesAttendus.length > 0 && dossierVisible
      ? completude(
          typesAttendus,
          docs.map((doc) => ({ docType: doc.docType as TypeDocument, status: doc.status, valableJusquAu: doc.validUntil })),
          maintenant,
        )
      : null
  return {
    param: systeme ? param : dossier.id,
    nom: dossier.name,
    systeme,
    nombre: docs.length,
    jauge,
    zone,
    texteZone: plusProche ? texteEcheance(plusProche.validUntil, maintenant) : "Sans échéance",
  }
}

// --- Dossier -----------------------------------------------------------------------------------

export type LigneDocument = {
  id: string
  titre: string
  typeLibelle: string
  typeDocument: string
  validite: string
  zone: Zone | null
  proprietaire: string
  visibilite: Visibilite
  statut: "actif" | "archive"
  joursRestants: number | null
}

export type DossierDonnees = {
  param: string
  nom: string
  systeme: boolean
  lignes: LigneDocument[]
  archives: LigneDocument[]
  proprietaires: Array<{ id: string; nom: string }>
  peutAjouter: Decision
  peutGerer: Decision
  visibilite: Visibilite
  // Dossier caché à la personne : elle n'y voit que les documents qui lui sont ouverts.
  partiel: boolean
}

export async function lireDossier(param: string, filtres: { type?: string; proprietaire?: string }): Promise<DossierDonnees | null> {
  const { ctx, niveau } = await accesDocuments("lecture")
  const acteur = await qui(ctx, niveau)
  const maintenant = new Date()
  const { dossiers, dossiersParId, documents, accesParDoc } = await charger(ctx, acteur.personId)

  const type = dossierTypeParCle(param)
  const ligne = type
    ? (dossiers.find((dossier) => dossier.kind === "systeme" && dossier.name === type.nom) ?? dossierVirtuel(type.nom))
    : dossiers.find((dossier) => dossier.id === param && dossier.kind === "perso")
  if (!ligne) return null

  const visibles = documents.filter((doc) => {
    if (doc.folderId !== ligne.id || ligne.id === "") return false
    const dossier = dossiersParId.get(doc.folderId)
    return dossier !== undefined && peutVoirDocument(documentPourDroits(doc, accesParDoc.get(doc.id) ?? null), dossierPourDroits(dossier), acteur)
  })
  // Un dossier caché ne s'ouvre que par les documents qui y sont ouverts à la personne.
  const partiel = !peutVoirDossier(dossierPourDroits(ligne), acteur)
  if (partiel && visibles.length === 0) return null
  const actifs = visibles.filter((doc) => doc.status === "actif")
  const filtres1 = actifs.filter((doc) => (filtres.type ? doc.docType === filtres.type : true))
  const filtres2 = filtres1.filter((doc) => {
    if (!filtres.proprietaire || filtres.proprietaire === "tous") return true
    if (filtres.proprietaire === "moi") return acteur.personId !== null && doc.ownerPersonId === acteur.personId
    return doc.ownerPersonId === filtres.proprietaire
  })

  const personnes = await prismaPourTeam(ctx.teamId, ctx.userId).corePerson.findMany({
    where: { teamId: ctx.teamId, id: { in: Array.from(new Set(visibles.map((doc) => doc.ownerPersonId).filter((id): id is string => id !== null))) } },
    select: { id: true, prenom: true, nom: true },
  })
  const nomDe = new Map(personnes.map((personne) => [personne.id, `${personne.prenom} ${personne.nom}`]))
  const emails = await emailsDeComptes(ctx, visibles.map((doc) => doc.createdBy))

  const ligneDe = (doc: Visible): LigneDocument => {
    const zone = zoneDocument(doc.validUntil, maintenant)
    return {
      id: doc.id,
      titre: doc.title,
      typeLibelle: LIBELLE_TYPE_DOCUMENT[doc.docType as TypeDocument],
      typeDocument: doc.docType,
      validite: texteEcheance(doc.validUntil, maintenant),
      zone,
      proprietaire: libelleAuteur(
        doc.ownerPersonId ? (nomDe.get(doc.ownerPersonId) ?? null) : null,
        doc.createdBy ? (emails.get(doc.createdBy) ?? null) : null,
      ),
      visibilite: doc.visibility,
      statut: doc.status,
      joursRestants: doc.validUntil ? joursAvantEcheance(doc.validUntil, maintenant) : null,
    }
  }

  return {
    param,
    nom: ligne.name,
    systeme: ligne.kind === "systeme",
    lignes: filtres2.map(ligneDe),
    archives: visibles.filter((doc) => doc.status === "archive").map(ligneDe),
    proprietaires: personnes.map((personne) => ({ id: personne.id, nom: `${personne.prenom} ${personne.nom}` })),
    peutAjouter: peutAjouterDocument(acteur),
    peutGerer: peutGererDossier(acteur),
    visibilite: ligne.visibility,
    partiel,
  }
}

// --- Fiche document ----------------------------------------------------------------------------

export type VersionLigne = {
  id: string
  numero: number
  date: string
  auteur: string
  commentaire: string | null
  fichierId: string
  nomFichier: string
}

export type AccesLigne = { id: string; personneId: string; nom: string; niveau: NiveauAcces }

export type FicheDocument = {
  id: string
  titre: string
  typeDocument: string
  reference: string | null
  dateEmission: string | null
  dateValidite: string | null
  notes: string | null
  visibilite: Visibilite
  statut: "actif" | "archive"
  dossierId: string
  // Clé de l'URL du dossier : la clé de type pour un dossier type, l'identifiant sinon (comme DossierDonnees.param).
  dossierParam: string
  dossierNom: string
  zone: Zone | null
  texteEcheance: string
  joursRestants: number | null
  versions: VersionLigne[]
  acces: AccesLigne[]
  // Une décision par geste : chaque bouton refusé affiche sa raison.
  gestes: {
    remplacer: Decision
    modifier: Decision
    archiver: Decision
    deplacer: Decision
    partager: Decision
  }
}

const jourCivil = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null)

export async function lireDocument(id: string): Promise<FicheDocument | null> {
  const { ctx, niveau } = await accesDocuments("lecture")
  const acteur = await qui(ctx, niveau)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const maintenant = new Date()

  const doc = await client.documentsDoc.findFirst({
    where: { id, teamId: ctx.teamId, deletedAt: null },
    select: {
      id: true,
      title: true,
      docType: true,
      reference: true,
      issuedOn: true,
      validUntil: true,
      notes: true,
      status: true,
      visibility: true,
      ownerPersonId: true,
      folderId: true,
      folder: { select: { id: true, name: true, kind: true, visibility: true, ownerPersonId: true } },
      versions: {
        where: { deletedAt: null },
        orderBy: { versionNo: "desc" },
        select: {
          id: true,
          versionNo: true,
          uploadedAt: true,
          uploadedBy: true,
          createdBy: true,
          comment: true,
          attachment: { select: { fileId: true } },
        },
      },
    },
  })
  if (!doc) return null

  const monAcces = acteur.personId
    ? await client.documentsAccess.findFirst({ where: { teamId: ctx.teamId, docId: id, personId: acteur.personId, deletedAt: null }, select: { level: true } })
    : null
  const droits = documentPourDroits(doc, (monAcces?.level as NiveauAcces | undefined) ?? null)
  const dossier = dossierPourDroits(doc.folder)
  if (!peutVoirDocument(droits, dossier, acteur)) return null

  const fichiers = await client.coreFile.findMany({
    where: { teamId: ctx.teamId, id: { in: doc.versions.map((version) => version.attachment.fileId) } },
    select: { id: true, nom: true },
  })
  const nomFichier = new Map(fichiers.map((fichier) => [fichier.id, fichier.nom]))

  const auteurs = await client.corePerson.findMany({
    where: { teamId: ctx.teamId, id: { in: doc.versions.map((version) => version.uploadedBy).filter((x): x is string => x !== null) } },
    select: { id: true, prenom: true, nom: true },
  })
  const nomAuteur = new Map(auteurs.map((personne) => [personne.id, `${personne.prenom} ${personne.nom}`]))
  const emails = await emailsDeComptes(ctx, doc.versions.map((version) => version.createdBy))

  // Liste des accès internes : seulement pour qui peut partager (niveau écriture).
  const partage = peutPartagerDocument(droits, dossier, acteur)
  const accesLignes: AccesLigne[] = []
  if (partage.permis) {
    const lignes = await client.documentsAccess.findMany({
      where: { teamId: ctx.teamId, docId: id, deletedAt: null },
      select: { id: true, personId: true, level: true, person: { select: { prenom: true, nom: true } } },
    })
    for (const ligne of lignes) {
      accesLignes.push({ id: ligne.id, personneId: ligne.personId, nom: `${ligne.person.prenom} ${ligne.person.nom}`, niveau: ligne.level as NiveauAcces })
    }
  }

  const zone = zoneDocument(doc.validUntil, maintenant)
  return {
    id: doc.id,
    titre: doc.title,
    typeDocument: doc.docType,
    reference: doc.reference,
    dateEmission: jourCivil(doc.issuedOn),
    dateValidite: jourCivil(doc.validUntil),
    notes: doc.notes,
    visibilite: doc.visibility,
    statut: doc.status,
    dossierId: doc.folder.id,
    dossierParam: doc.folder.kind === "systeme" ? (DOSSIERS_TYPES.find((type) => type.nom === doc.folder.name)?.cle ?? doc.folder.id) : doc.folder.id,
    dossierNom: doc.folder.name,
    zone,
    texteEcheance: texteEcheance(doc.validUntil, maintenant),
    joursRestants: doc.validUntil ? joursAvantEcheance(doc.validUntil, maintenant) : null,
    versions: doc.versions.map((version) => ({
      id: version.id,
      numero: version.versionNo,
      date: jourDeParis(version.uploadedAt),
      auteur: libelleAuteur(
        version.uploadedBy ? (nomAuteur.get(version.uploadedBy) ?? null) : null,
        version.createdBy ? (emails.get(version.createdBy) ?? null) : null,
      ),
      commentaire: version.comment,
      fichierId: version.attachment.fileId,
      nomFichier: nomFichier.get(version.attachment.fileId) ?? "Fichier",
    })),
    acces: accesLignes,
    gestes: {
      remplacer: peutModifierDocument(droits, dossier, acteur),
      modifier: peutModifierDocument(droits, dossier, acteur),
      archiver: peutArchiverDocument(droits, dossier, acteur),
      deplacer: peutDeplacerDocument(droits, dossier, acteur),
      partager: partage,
    },
  }
}

// --- Listes pour les formulaires ---------------------------------------------------------------

// Membres qui ont un compte actif : seuls ceux-là peuvent recevoir un accès interne.
export async function lirePersonnesPartage(): Promise<Array<{ id: string; nom: string }>> {
  const { ctx } = await accesDocuments("ecriture")
  const personnes = await prismaPourTeam(ctx.teamId, ctx.userId).corePerson.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, userId: { not: null } },
    select: { id: true, prenom: true, nom: true },
    orderBy: [{ prenom: "asc" }, { nom: "asc" }],
  })
  return personnes.map((personne) => ({ id: personne.id, nom: `${personne.prenom} ${personne.nom}` }))
}

// Dossiers où l'on peut ranger un document (ceux qu'on voit), dans l'ordre du coffre-fort.
export async function lireDossiersRangement(): Promise<Array<{ param: string; nom: string }>> {
  const { ctx, niveau } = await accesDocuments("contribution")
  const acteur = await qui(ctx, niveau)
  const { dossiers } = await charger(ctx, acteur.personId)
  const rangement: Array<{ param: string; nom: string }> = []
  for (const type of DOSSIERS_TYPES) {
    const ligne = dossiers.find((dossier) => dossier.kind === "systeme" && dossier.name === type.nom)
    if (!ligne || peutVoirDossier(dossierPourDroits(ligne), acteur)) rangement.push({ param: type.cle, nom: type.nom })
  }
  for (const dossier of dossiers) {
    if (dossier.kind === "perso" && peutVoirDossier(dossierPourDroits(dossier), acteur)) rangement.push({ param: dossier.id, nom: dossier.name })
  }
  return rangement
}
