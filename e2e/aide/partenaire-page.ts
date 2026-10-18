// Données de la page partenaire pour les tests de bout en bout (brief 3.7, §8) : deux partenaires, A avec une
// convention signée et une brouillon, B avec sa propre convention ; deux preuves (une visible, une masquée) ; un
// résultat public et un résultat masqué ; un bilan. Les écritures passent par pg (SQL direct), comme session.ts.
// Les fichiers sont copiés dans le stockage de test (.e2e-stockage) et référencés par core_file.
import "./env"

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { Pool } from "pg"

import { newId } from "../../src/core/ids"

import { ajouterVoitureSaxo, preparerSaison, type Equipe } from "./session"

const RACINE = path.resolve(__dirname, "..", "..")
const DOSSIER_STOCKAGE = path.join(RACINE, ".e2e-stockage")
const PDF_DE_TEST = path.join(RACINE, "e2e", "fichiers", "preuve.pdf")
const PHOTO_DE_TEST = path.join(RACINE, "e2e", "fichiers", "logo.png")

let pool: Pool | null = null

function bd(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
    if (!connectionString) throw new Error("DATABASE_URL_MIGRATION absente : les tests ne peuvent pas écrire la page partenaire.")
    pool = new Pool({ connectionString, idleTimeoutMillis: 10_000, max: 2 })
  }
  return pool
}

export interface PageDePartenaire {
  saisonId: string
  nomA: string
  nomB: string
  partenaireA: string
  partenaireB: string
  conventionA: string
  conventionABrouillon: string
  conventionB: string
  fichierDocumentA: string
  fichierDocumentB: string
  fichierPreuveVisible: string
  fichierPreuveMasquee: string
  fichierBilan: string
  // Fichier d'une autre team : la route doit le refuser pour cette team.
  fichierAutreTeam: string
  vehiculeId: string
}

// Copie un fichier de test dans le stockage et l'enregistre pour la team ; renvoie son identifiant.
async function fichierDeTest(teamId: string, source: string, nom: string, mime: string): Promise<string> {
  const octets = fs.readFileSync(source)
  const id = newId()
  const cle = `${teamId}/e2e/${id}`
  const destination = path.join(DOSSIER_STOCKAGE, ...cle.split("/"))
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, octets)
  const empreinte = createHash("sha256").update(octets).digest("hex")
  await bd().query(
    `INSERT INTO core_file (id, team_id, storage_key, nom, mime_type, taille, empreinte, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [id, teamId, cle, nom, mime, octets.length, empreinte],
  )
  return id
}

// Un partenaire avec son contact (la « fiche » de l'entreprise) ; renvoie l'identifiant du partenaire.
async function partenaire(teamId: string, nom: string): Promise<string> {
  const contactId = newId()
  const partenaireId = newId()
  await bd().query(`INSERT INTO core_contact (id, team_id, nom, updated_at) VALUES ($1, $2, $3, now())`, [contactId, teamId, nom])
  await bd().query(`INSERT INTO partenaires_partner (id, team_id, contact_id, updated_at) VALUES ($1, $2, $3, now())`, [partenaireId, teamId, contactId])
  return partenaireId
}

async function convention(
  teamId: string,
  partenaireId: string,
  saisonId: string,
  statut: "brouillon" | "signee",
  dates: { debut: string; fin: string },
  documentSigneId: string | null,
): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO partenaires_agreement (id, team_id, partner_id, season_id, date_debut, date_fin, statut, apport_financier_centimes,
       signee_le, signataires, document_signe_file_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::partenaires_agreement_statut, 150000, $8, $9, $10, now())`,
    [
      id,
      teamId,
      partenaireId,
      saisonId,
      dates.debut,
      dates.fin,
      statut,
      statut === "signee" ? "2027-02-01" : null,
      statut === "signee" ? "Jo Koehling et Aurélie Spiesser" : null,
      documentSigneId,
    ],
  )
  return id
}

async function contrepartie(teamId: string, conventionId: string, libelle: string, promise: number, tenue: number): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO partenaires_benefit (id, team_id, agreement_id, libelle, type, quantite_promise, quantite_tenue, statut, updated_at)
     VALUES ($1, $2, $3, $4, 'publication_reseaux', $5, $6, $7, now())`,
    [id, teamId, conventionId, libelle, promise, tenue, tenue >= promise ? "tenue" : "a_faire"],
  )
  return id
}

async function preuve(teamId: string, contrepartieId: string, fichierId: string, visible: boolean, commentaire: string): Promise<void> {
  await bd().query(
    `INSERT INTO partenaires_proof (id, team_id, benefit_id, date, type, file_id, commentaire, visible_partenaire, updated_at)
     VALUES ($1, $2, $3, '2027-06-10', 'photo', $4, $5, $6, now())`,
    [newId(), teamId, contrepartieId, fichierId, commentaire, visible],
  )
}

// Un rallye de la saison, engagé avec la voiture de test, et son résultat (public ou masqué). Le classement sert à
// distinguer les deux résultats dans la page : le nom de l'épreuve, lui, figure au calendrier dans les deux cas.
async function resultat(
  teamId: string,
  saisonId: string,
  vehiculeId: string,
  nom: string,
  publicResultat: boolean,
  classementGeneral: number,
): Promise<void> {
  const eventId = newId()
  const entreeId = newId()
  await bd().query(
    `INSERT INTO core_event (id, team_id, season_id, type, nom, date_debut, date_fin, updated_at)
     VALUES ($1, $2, $3, 'rallye', $4, '2027-05-01', '2027-05-02', now())`,
    [eventId, teamId, saisonId, nom],
  )
  await bd().query(
    `INSERT INTO core_event_entry (id, team_id, event_id, vehicle_id, updated_at) VALUES ($1, $2, $3, $4, now())`,
    [entreeId, teamId, eventId, vehiculeId],
  )
  await bd().query(
    `INSERT INTO saison_result (id, team_id, entry_id, statut_final, public, validation, classement_general, nb_classes, updated_at)
     VALUES ($1, $2, $3, 'arrivee', $4, 'valide', $5, 40, now())`,
    [newId(), teamId, entreeId, publicResultat, classementGeneral],
  )
}

// Prépare la team de test : la page de A et celle de B, et une autre team avec son propre fichier.
export async function preparerPageDePartenaire(equipe: Equipe, autreTeam: Equipe): Promise<PageDePartenaire> {
  const saisonId = await preparerSaison(equipe, 2027)
  const vehiculeId = await ajouterVoitureSaxo(equipe, "Saxo page partenaire")
  const nomA = "Garage Alpha"
  const nomB = "Garage Beta"
  const partenaireA = await partenaire(equipe.teamId, nomA)
  const partenaireB = await partenaire(equipe.teamId, nomB)

  const fichierDocumentA = await fichierDeTest(equipe.teamId, PDF_DE_TEST, "convention-alpha.pdf", "application/pdf")
  const fichierDocumentB = await fichierDeTest(equipe.teamId, PDF_DE_TEST, "convention-beta.pdf", "application/pdf")
  const fichierPreuveVisible = await fichierDeTest(equipe.teamId, PHOTO_DE_TEST, "photo-visible.png", "image/png")
  const fichierPreuveMasquee = await fichierDeTest(equipe.teamId, PHOTO_DE_TEST, "photo-masquee.png", "image/png")
  const fichierBilan = await fichierDeTest(equipe.teamId, PDF_DE_TEST, "bilan-alpha.pdf", "application/pdf")
  const fichierAutreTeam = await fichierDeTest(autreTeam.teamId, PDF_DE_TEST, "autre-team.pdf", "application/pdf")

  const conventionA = await convention(equipe.teamId, partenaireA, saisonId, "signee", { debut: "2027-01-01", fin: "2027-12-31" }, fichierDocumentA)
  const conventionABrouillon = await convention(equipe.teamId, partenaireA, saisonId, "brouillon", { debut: "2028-01-01", fin: "2028-12-31" }, null)
  const conventionB = await convention(equipe.teamId, partenaireB, saisonId, "signee", { debut: "2027-01-01", fin: "2027-12-31" }, fichierDocumentB)

  const publicationA = await contrepartie(equipe.teamId, conventionA, "Publications Alpha", 4, 1)
  await contrepartie(equipe.teamId, conventionABrouillon, "Contrepartie brouillon secrète", 2, 0)
  await contrepartie(equipe.teamId, conventionB, "Contrepartie de Beta", 1, 0)
  await preuve(equipe.teamId, publicationA, fichierPreuveVisible, true, "Photo prise au départ")
  await preuve(equipe.teamId, publicationA, fichierPreuveMasquee, false, "Note interne masquée")

  await resultat(equipe.teamId, saisonId, vehiculeId, "Rallye public de test", true, 3)
  await resultat(equipe.teamId, saisonId, vehiculeId, "Rallye masqué de test", false, 11)

  await bd().query(
    `INSERT INTO partenaires_report (id, team_id, partner_id, agreement_id, periode_debut, periode_fin, file_id, updated_at)
     VALUES ($1, $2, $3, $4, '2027-01-01', '2027-06-30', $5, now())`,
    [newId(), equipe.teamId, partenaireA, conventionA, fichierBilan],
  )

  return {
    saisonId,
    nomA,
    nomB,
    partenaireA,
    partenaireB,
    conventionA,
    conventionABrouillon,
    conventionB,
    fichierDocumentA,
    fichierDocumentB,
    fichierPreuveVisible,
    fichierPreuveMasquee,
    fichierBilan,
    fichierAutreTeam,
    vehiculeId,
  }
}

// Mentions légales de la convention d'exemple : forme juridique, siège et signataire de la team, adresse du partenaire.
// Le siège, le signataire et l'adresse sont des valeurs de test, visiblement fictives : elles ne sont pas des
// coordonnées réelles. La forme juridique est celle de la team (association de droit local, en cours d'inscription).
export async function renseignerMentionsConvention(equipe: Equipe, partenaireId: string): Promise<void> {
  await bd().query(
    `UPDATE core_team SET forme_juridique = $2, association_siege = $3, signataire_nom = $4, signataire_qualite = $5, updated_at = now()
     WHERE id = $1`,
    [
      equipe.teamId,
      "association de droit local d'Alsace-Moselle",
      "Siège de test, 00000 Ville de test",
      "Personne de test",
      "Présidente de test",
    ],
  )
  await bd().query(
    `UPDATE core_contact SET adresse = $2, updated_at = now()
     WHERE id = (SELECT contact_id FROM partenaires_partner WHERE id = $1 AND team_id = $3)`,
    [partenaireId, "Adresse du partenaire de test, 00000 Ville de test", equipe.teamId],
  )
}

// Le lien créé par l'interface : sa date d'expiration passe dans le passé (cas du lien expiré).
export async function expirerLien(equipe: Equipe, partenaireId: string): Promise<void> {
  await bd().query(
    `UPDATE partenaires_portal_link SET expire_le = now() - interval '1 day' WHERE team_id = $1 AND partner_id = $2 AND actif`,
    [equipe.teamId, partenaireId],
  )
}

// Jeton de test noté dans le stockage de test : le contrôle du journal serveur le cherche ensuite.
export function noterJetonDeTest(jeton: string): void {
  fs.mkdirSync(DOSSIER_STOCKAGE, { recursive: true })
  fs.appendFileSync(path.join(DOSSIER_STOCKAGE, "jetons-de-test.txt"), `${jeton}\n`)
}
