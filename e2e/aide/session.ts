// Aide des tests de bout en bout : crée une team jetable, ses comptes et ses jetons de
// connexion, avec le rôle propriétaire (DATABASE_URL_MIGRATION). Rien n'est ajouté au code
// de l'application : le lien et le code sont hachés comme le fait l'app.
//
// Les écritures passent par pg (SQL direct) : le client Prisma généré est un module ESM, que
// le chargeur de Playwright (CJS) ne sait pas lire. L'émission d'un événement, elle, passe
// par le vrai bus de l'app, dans un processus tsx (cf. emettre-action.ts).
import "./env"

import { execFileSync } from "node:child_process"
import path from "node:path"

import { Pool, type PoolClient } from "pg"

import { APPS } from "../../src/core/catalogue"
import { newId } from "../../src/core/ids"
import {
  calculerExpiration,
  DUREE_CODE_MINUTES,
  DUREE_LIEN_MINUTES,
  genererSecretLien,
  hacherCode,
  hacherSecret,
} from "../../src/core/auth/jetons"

export const CODE_CONNU = "428613"

export interface Membre {
  userId: string
  membershipId: string
  email: string
}

export interface Equipe {
  teamId: string
  nomTeam: string
  slug: string
  responsable: Membre
  equipiers: Membre[]
  secretLien: string
  horodatage: string
}

let pool: Pool | null = null

function bd(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
    if (!connectionString) throw new Error("DATABASE_URL_MIGRATION absente : les tests ne peuvent pas créer de team.")
    pool = new Pool({ connectionString, idleTimeoutMillis: 10_000, max: 2 })
  }
  return pool
}

async function ajouterMembre(teamId: string, email: string, role: "responsable" | "equipage" | "assistance"): Promise<Membre> {
  const userId = newId()
  const membershipId = newId()
  await bd().query("INSERT INTO core_user (id, email, updated_at) VALUES ($1, $2, now())", [userId, email])
  await bd().query(
    `INSERT INTO core_membership (id, team_id, user_id, role, statut, updated_at)
     VALUES ($1, $2, $3, $4::core_role, 'actif'::core_membership_statut, now())`,
    [membershipId, teamId, userId, role],
  )
  return { userId, membershipId, email }
}

// Team « E2E <horodatage> » : 11 apps activées, un responsable, un jeton de lien valable.
export async function creerEquipe(): Promise<Equipe> {
  const horodatage = Date.now().toString(36)
  const nomTeam = `E2E ${horodatage}`
  const slug = `e2e-${horodatage}`
  const email = `e2e-${horodatage}@example.test`

  const teamId = newId()
  await bd().query(
    `INSERT INTO core_team (id, nom, slug, statut, updated_at) VALUES ($1, $2, $3, 'active'::core_team_statut, now())`,
    [teamId, nomTeam, slug],
  )
  for (let index = 0; index < APPS.length; index++) {
    const app = APPS[index]
    await bd().query(
      `INSERT INTO core_team_app (id, team_id, app_cle, activee, version_installee, ordre, updated_at)
       VALUES ($1, $2, $3, true, $4, $5, now())`,
      [newId(), teamId, app.cle, app.version, index + 1],
    )
  }

  const responsable = await ajouterMembre(teamId, email, "responsable")

  const secretLien = genererSecretLien()
  await bd().query(
    `INSERT INTO core_auth_token (id, user_id, type, hash, expire_at, updated_at)
     VALUES ($1, $2, 'lien'::core_auth_token_type, $3, $4, now())`,
    [newId(), responsable.userId, hacherSecret(secretLien), calculerExpiration(new Date(), DUREE_LIEN_MINUTES)],
  )

  return { teamId, nomTeam, slug, responsable, equipiers: [], secretLien, horodatage }
}

// Second membre actif (équipage), pour les droits par membre.
export async function ajouterEquipier(equipe: Equipe): Promise<Membre> {
  const email = `e2e-${equipe.horodatage}-equipier@example.test`
  const membre = await ajouterMembre(equipe.teamId, email, "equipage")
  equipe.equipiers.push(membre)
  return membre
}

// Le membre quitte la team : son adhésion passe à « parti ». Ses sessions restent valides.
export async function retirerAdhesion(membre: Membre): Promise<void> {
  await bd().query(
    "UPDATE core_membership SET statut = 'parti'::core_membership_statut, updated_at = now() WHERE id = $1",
    [membre.membershipId],
  )
}

// Jeton de code avec un code connu. Le formulaire demande un code après l'adresse : l'aide
// ajoute ce jeton après cette étape, avec le même hachage que l'app.
export async function ajouterCodeConnu(email: string, code: string = CODE_CONNU): Promise<void> {
  const { rows } = await bd().query<{ id: string }>("SELECT id FROM core_user WHERE email = $1", [email])
  if (rows.length === 0) throw new Error(`Compte introuvable pour ${email}.`)
  await bd().query(
    `INSERT INTO core_auth_token (id, user_id, type, hash, expire_at, updated_at)
     VALUES ($1, $2, 'code'::core_auth_token_type, $3, $4, now())`,
    [newId(), rows[0].id, hacherCode(email, code), calculerExpiration(new Date(), DUREE_CODE_MINUTES)],
  )
}

// Émet saison.action_requise par le bus de l'app (bus, gestionnaire, core_action), dans un
// processus tsx : l'app et ses modules de données n'ont pas à tourner dans le processus de test.
export function emettreActionSaison(equipe: Equipe, cleUnicite: string): void {
  const charge = JSON.stringify({
    teamId: equipe.teamId,
    userId: equipe.responsable.userId,
    membershipId: equipe.responsable.membershipId,
    cleUnicite,
  })
  const script = path.join(__dirname, "emettre-action.ts")
  execFileSync(process.execPath, ["--import", "tsx", script, charge], {
    cwd: path.join(__dirname, "..", ".."),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  })
}

// Montant réglé d'un engagement, en centimes (null tant qu'il n'est pas payé). Le statut affiché dépend
// aussi de la date de l'épreuve (« Parti » une fois commencée), donc le paiement se lit ici.
export async function montantPayeEnBase(equipe: Equipe, entryId: string): Promise<number | null> {
  const { rows } = await bd().query<{ montant: number | null }>(
    "SELECT montant_paye AS montant FROM saison_registration WHERE team_id = $1 AND entry_id = $2",
    [equipe.teamId, entryId],
  )
  return rows[0]?.montant ?? null
}

export async function statutAction(equipe: Equipe, cleUnicite: string): Promise<string | null> {
  const { rows } = await bd().query<{ statut: string }>(
    "SELECT statut::text AS statut FROM core_action WHERE team_id = $1 AND cle_unicite = $2",
    [equipe.teamId, cleUnicite],
  )
  return rows[0]?.statut ?? null
}

// Engagements de la team en base, non supprimés : une ligne par voiture engagée.
export async function engagementsEnBase(equipe: Equipe): Promise<Array<{ id: string }>> {
  const { rows } = await bd().query<{ id: string }>(
    "SELECT id::text AS id FROM saison_registration WHERE team_id = $1 AND deleted_at IS NULL",
    [equipe.teamId],
  )
  return rows
}

// Liens de la page partenaire en base, dont l'empreinte est égale à ce jeton en clair : doit être zéro (le jeton
// n'est jamais stocké, seulement son empreinte).
export async function jetonEnClairEnBase(equipe: Equipe, jeton: string): Promise<number> {
  const { rows } = await bd().query<{ n: number }>(
    "SELECT count(*)::int AS n FROM partenaires_portal_link WHERE team_id = $1 AND jeton_empreinte = $2",
    [equipe.teamId, jeton],
  )
  return rows[0].n
}

export async function compterEvenements(equipe: Equipe, nom: string): Promise<number> {
  const { rows } = await bd().query<{ n: number }>(
    "SELECT count(*)::int AS n FROM core_domain_event WHERE team_id = $1 AND nom = $2",
    [equipe.teamId, nom],
  )
  return rows[0].n
}

// Notes de la team portant ce texte, non supprimées : combien en base.
export async function notesEnBase(equipe: Equipe, texte: string): Promise<number> {
  const { rows } = await bd().query<{ n: number }>(
    "SELECT count(*)::int AS n FROM core_note WHERE team_id = $1 AND texte = $2 AND deleted_at IS NULL",
    [equipe.teamId, texte],
  )
  return rows[0].n
}

export async function modeTerrainEnBase(equipe: Equipe): Promise<boolean | null> {
  const { rows } = await bd().query<{ mode_terrain: boolean }>(
    "SELECT mode_terrain FROM settings_member_pref WHERE membership_id = $1",
    [equipe.responsable.membershipId],
  )
  return rows[0]?.mode_terrain ?? null
}

export async function droitEnBase(membre: Membre, appCle: string): Promise<string | null> {
  const { rows } = await bd().query<{ niveau: string }>(
    "SELECT niveau::text AS niveau FROM core_app_access WHERE membership_id = $1 AND app_cle = $2",
    [membre.membershipId, appCle],
  )
  return rows[0]?.niveau ?? null
}

// Demandes de suppression d'une portée : combien ont été faites, et combien sont annulées.
export async function compterSuppressions(equipe: Equipe, portee: "compte" | "team"): Promise<{ total: number; annulees: number }> {
  const { rows } = await bd().query<{ total: number; annulees: number }>(
    `SELECT count(*)::int AS total, count(annulee_at)::int AS annulees
     FROM settings_deletion_request WHERE team_id = $1 AND portee = $2::settings_portee_suppression`,
    [equipe.teamId, portee],
  )
  return rows[0]
}

// Membre d'un rôle donné, avec un lien de connexion : pour jouer un autre compte dans le même
// navigateur ou un autre contexte (ex. assistance). Le membre est ajouté à la liste nettoyée.
export async function ajouterMembreConnectable(equipe: Equipe, role: "equipage" | "assistance", suffixe = ""): Promise<Membre & { secretLien: string }> {
  const email = `e2e-${equipe.horodatage}-${role}${suffixe}@example.test`
  const membre = await ajouterMembre(equipe.teamId, email, role)
  equipe.equipiers.push(membre)
  const secretLien = genererSecretLien()
  await bd().query(
    `INSERT INTO core_auth_token (id, user_id, type, hash, expire_at, updated_at)
     VALUES ($1, $2, 'lien'::core_auth_token_type, $3, $4, now())`,
    [newId(), membre.userId, hacherSecret(secretLien), calculerExpiration(new Date(), DUREE_LIEN_MINUTES)],
  )
  return { ...membre, secretLien }
}

// Données de démonstration (Koehling) et une action et une alerte, pour les captures.
export function preparerDonneesCaptures(equipe: Equipe): void {
  const charge = JSON.stringify({
    teamId: equipe.teamId,
    userId: equipe.responsable.userId,
    membershipId: equipe.responsable.membershipId,
    horodatage: equipe.horodatage,
  })
  const script = path.join(__dirname, "donnees-equipe.ts")
  execFileSync(process.execPath, ["--import", "tsx", script, charge], {
    cwd: path.join(__dirname, "..", ".."),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  })
}

// Nettoyage complet : toutes les tables avec team_id, la team, puis les comptes de test.
// session_replication_role désactive les clés étrangères le temps de la transaction : il
// faut le rôle propriétaire (superutilisateur en développement).
export async function supprimerEquipe(equipe: Equipe): Promise<void> {
  const utilisateurs = [equipe.responsable.userId, ...equipe.equipiers.map((m) => m.userId)]
  const client: PoolClient = await bd().connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL session_replication_role = replica")
    const { rows: tables } = await client.query<{ table_name: string }>(
      `SELECT table_name::text AS table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'team_id'`,
    )
    for (const { table_name } of tables) {
      await client.query(`DELETE FROM "${table_name}" WHERE team_id = $1`, [equipe.teamId])
    }
    await client.query("DELETE FROM core_team WHERE id = $1", [equipe.teamId])
    await client.query("DELETE FROM core_auth_token WHERE user_id = ANY($1::uuid[])", [utilisateurs])
    await client.query("DELETE FROM core_device WHERE user_id = ANY($1::uuid[])", [utilisateurs])
    await client.query("DELETE FROM core_user WHERE id = ANY($1::uuid[])", [utilisateurs])
    await client.query("COMMIT")
  } catch (erreur) {
    await client.query("ROLLBACK")
    throw erreur
  } finally {
    client.release()
  }
}

// Saison : une saison de test pour l'année donnée, et une voiture de course active pour la team.
export async function preparerSaison(equipe: Equipe, annee: number): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO core_season (id, team_id, annee, nom, date_debut, date_fin, en_cours, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, now())`,
    [id, equipe.teamId, annee, `Saison ${annee}`, `${annee}-01-01`, `${annee}-12-31`],
  )
  return id
}

export async function ajouterVoitureDeCourse(equipe: Equipe, nomCourt = "Saxo test e2e"): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO core_vehicle (id, team_id, type, nom_court, actif, updated_at)
     VALUES ($1, $2, 'course'::core_vehicle_type, $3, true, now())`,
    [id, equipe.teamId, nomCourt],
  )
  return id
}

// Voiture (3.3) : donne à un membre un niveau explicite sur Voiture, pour que le scénario ne dépende pas des
// valeurs par défaut des rôles. « aucun » : la personne n'a pas accès à l'app (l'écran de refus).
export async function donnerAccesVoiture(equipe: Equipe, membre: Membre, niveau: "aucun" | "lecture" | "contribution" | "ecriture" | "gestion"): Promise<void> {
  await bd().query(`DELETE FROM core_app_access WHERE team_id = $1 AND membership_id = $2 AND app_cle = 'voiture'`, [equipe.teamId, membre.membershipId])
  await bd().query(
    `INSERT INTO core_app_access (id, team_id, membership_id, app_cle, niveau, updated_at)
     VALUES ($1, $2, $3, 'voiture', $4::core_access_level, now())`,
    [newId(), equipe.teamId, membre.membershipId, niveau],
  )
}

// Véhicule de Voiture complet (ligne du socle et fiche Voiture), sans emplacement : pour une fiche de réglage.
export async function ajouterVoitureSaxo(equipe: Equipe, nomCourt: string): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO core_vehicle (id, team_id, type, nom_court, actif, updated_at)
     VALUES ($1, $2, 'course'::core_vehicle_type, $3, true, now())`,
    [id, equipe.teamId, nomCourt],
  )
  await bd().query(`INSERT INTO voiture_vehicle (id, team_id, vehicle_id, updated_at) VALUES ($1, $2, $3, now())`, [newId(), equipe.teamId, id])
  return id
}

// Fiches de réglage de Voiture en base, non supprimées, de la plus ancienne à la plus récente.
export async function reglagesVoitureEnBase(equipe: Equipe): Promise<Array<{ id: string; vehicleId: string; createdBy: string | null; valeurs: Record<string, number>; note: number | null }>> {
  const { rows } = await bd().query(
    `SELECT id, vehicle_id AS "vehicleId", created_by AS "createdBy", valeurs, note FROM voiture_setup
     WHERE team_id = $1 AND deleted_at IS NULL ORDER BY created_at, id`,
    [equipe.teamId],
  )
  return rows
}

// Saison (2.3) : donne à un membre un niveau explicite sur Saison, pour que le scénario ne dépende
// pas des valeurs par défaut des rôles.
export async function donnerAccesSaison(equipe: Equipe, membre: Membre, niveau: "lecture" | "contribution" | "ecriture" | "gestion"): Promise<void> {
  await bd().query(
    `INSERT INTO core_app_access (id, team_id, membership_id, app_cle, niveau, updated_at)
     VALUES ($1, $2, $3, 'saison', $4::core_access_level, now())`,
    [newId(), equipe.teamId, membre.membershipId, niveau],
  )
}

// Accès à Budget d'un membre, forcé à un niveau : « aucun » pour tester le cloisonnement des fichiers (tâche 3.1).
export async function definirAccesBudget(equipe: Equipe, membre: Membre, niveau: "aucun" | "lecture" | "contribution"): Promise<void> {
  await bd().query(`DELETE FROM core_app_access WHERE team_id = $1 AND membership_id = $2 AND app_cle = 'budget'`, [equipe.teamId, membre.membershipId])
  await bd().query(
    `INSERT INTO core_app_access (id, team_id, membership_id, app_cle, niveau, updated_at)
     VALUES ($1, $2, $3, 'budget', $4::core_access_level, now())`,
    [newId(), equipe.teamId, membre.membershipId, niveau],
  )
}

// Photo du ticket d'une dépense, en base (tâche 3.2) : l'identifiant du fichier, ou null.
export async function justificatifDepenseEnBase(equipe: Equipe, depenseId: string): Promise<string | null> {
  const { rows } = await bd().query<{ justificatif: string | null }>(
    `SELECT justificatif_file_id AS justificatif FROM budget_expense WHERE team_id = $1 AND id = $2`,
    [equipe.teamId, depenseId],
  )
  return rows[0]?.justificatif ?? null
}

// Logo de la team, en base (tâche 3.1) : l'identifiant du fichier, ou null.
export async function logoEquipeEnBase(equipe: Equipe): Promise<string | null> {
  const { rows } = await bd().query<{ logo: string | null }>(`SELECT logo_file_id AS logo FROM core_team WHERE id = $1`, [equipe.teamId])
  return rows[0]?.logo ?? null
}

// Sorties de reconnaissance de la team, à une date civile (tâche 2.4 : écrites hors ligne, puis synchronisées).
export async function sortiesRecceEnBase(equipe: Equipe, date: string): Promise<number> {
  const { rows } = await bd().query<{ n: number }>(
    "SELECT count(*)::int AS n FROM saison_recce_session WHERE team_id = $1 AND date = $2::date AND deleted_at IS NULL",
    [equipe.teamId, date],
  )
  return rows[0].n
}

// Débriefs d'un engagement, non supprimés : combien en base (tâche 2.5 : écrits hors ligne, puis synchronisés).
export async function debriefsEnBase(equipe: Equipe, entryId: string): Promise<number> {
  const { rows } = await bd().query<{ n: number }>(
    "SELECT count(*)::int AS n FROM saison_debrief WHERE team_id = $1 AND entry_id = $2::uuid AND deleted_at IS NULL",
    [equipe.teamId, entryId],
  )
  return rows[0].n
}

// Rattache une personne de la team à un membre (Budget : « Moi », payeur membre). Renvoie son identifiant.
export async function rattacherPersonne(equipe: Equipe, membre: Membre, prenom: string, nom: string): Promise<string> {
  const personneId = newId()
  await bd().query("INSERT INTO core_person (id, team_id, nom, prenom, updated_at) VALUES ($1, $2, $3, $4, now())", [personneId, equipe.teamId, nom, prenom])
  await bd().query("UPDATE core_membership SET person_id = $1 WHERE id = $2", [personneId, membre.membershipId])
  return personneId
}

// Propose un mouvement à confirmer dans Budget (service réel, dans un processus tsx), comme un garage le ferait.
export function proposerMouvementBudget(equipe: Equipe, libelle: string, montant: number): void {
  const charge = JSON.stringify({
    teamId: equipe.teamId,
    userId: equipe.responsable.userId,
    membershipId: equipe.responsable.membershipId,
    libelle,
    montant,
  })
  const script = path.join(__dirname, "proposer-mouvement.ts")
  execFileSync(process.execPath, ["--import", "tsx", script, charge], {
    cwd: path.join(__dirname, "..", ".."),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  })
}

// Dépenses de Budget de la team, non supprimées, dans l'ordre de création.
export interface DepenseBudgetEnBase {
  libelle: string
  montant: number
  confirmee: boolean
  remboursement: string
  origine: string
  personneId: string | null
}

export async function depensesBudgetEnBase(equipe: Equipe): Promise<DepenseBudgetEnBase[]> {
  const { rows } = await bd().query<DepenseBudgetEnBase>(
    `SELECT e.libelle, e.montant, e.confirmee, e.remboursement::text AS remboursement, e.origine::text AS origine, p.person_id AS "personneId"
     FROM budget_expense e JOIN budget_payer p ON p.id = e.payer_id
     WHERE e.team_id = $1 AND e.deleted_at IS NULL ORDER BY e.created_at`,
    [equipe.teamId],
  )
  return rows
}

// Total remboursé à une personne, en centimes.
export async function rembourseEnBase(equipe: Equipe, personneId: string): Promise<number> {
  const { rows } = await bd().query<{ total: number }>(
    "SELECT COALESCE(SUM(montant), 0)::int AS total FROM budget_reimbursement WHERE team_id = $1 AND person_id = $2 AND deleted_at IS NULL",
    [equipe.teamId, personneId],
  )
  return rows[0].total
}

// Dépense de Budget de la team à ce libellé, non supprimée : son identifiant et son montant en centimes.
export async function depenseBudgetParLibelle(equipe: Equipe, libelle: string): Promise<{ id: string; montant: number } | null> {
  const { rows } = await bd().query<{ id: string; montant: number }>(
    "SELECT id, montant FROM budget_expense WHERE team_id = $1 AND libelle = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
    [equipe.teamId, libelle],
  )
  return rows[0] ?? null
}

// Prévu d'une épreuve dans la catégorie Engagement (tâche 2.8 : l'assistance ne doit pas le voir).
export async function preverEpreuveEnBase(equipe: Equipe, eventId: string, montant: number): Promise<void> {
  await bd().query(
    `INSERT INTO budget_forecast (id, team_id, season_id, category_id, event_id, montant, devise, updated_at)
     SELECT $1, $2, e.season_id, c.id, e.id, $3, 'EUR', now()
     FROM core_event e JOIN budget_category c ON c.team_id = e.team_id AND c.nom = 'Engagement' AND c.sens = 'depense'
     WHERE e.id = $4 AND e.team_id = $2`,
    [newId(), equipe.teamId, montant, eventId],
  )
}

// Logo de la team, posé directement en base : le PDF du bilan le lit (le téléversement est testé à part).
export async function definirLogoTeamEnBase(equipe: Equipe, fichierId: string | null): Promise<void> {
  await bd().query("UPDATE core_team SET logo_file_id = $2 WHERE id = $1", [equipe.teamId, fichierId])
}

// Recette de Budget (catégorie Partenaire) dans une saison, encaissée ou prévue : données du bilan.
export async function ajouterRecetteBudgetEnBase(equipe: Equipe, saisonId: string, libelle: string, montant: number, encaissee: boolean): Promise<void> {
  await bd().query(
    `INSERT INTO budget_income (id, team_id, date, montant, category_id, libelle, statut, encaissee_le, season_id, updated_at)
     SELECT $1, $2, CURRENT_DATE, $3, c.id, $4, $5::budget_statut_recette, CASE WHEN $6::boolean THEN CURRENT_DATE END, $7, now()
     FROM budget_category c WHERE c.team_id = $2 AND c.sens = 'recette' AND c.nom = 'Partenaire'`,
    [newId(), equipe.teamId, montant, libelle, encaissee ? "encaissee" : "prevue", encaissee, saisonId],
  )
}

// Prévisionnel de la saison, hors épreuve, pour une catégorie de dépense : données du bilan.
export async function preverSaisonEnBase(equipe: Equipe, saisonId: string, nomCategorie: string, montant: number): Promise<void> {
  await bd().query(
    `INSERT INTO budget_forecast (id, team_id, season_id, category_id, event_id, montant, devise, updated_at)
     SELECT $1, $2, $3, c.id, NULL, $4, 'EUR', now() FROM budget_category c WHERE c.team_id = $2 AND c.sens = 'depense' AND c.nom = $5`,
    [newId(), equipe.teamId, saisonId, montant, nomCategorie],
  )
}

// Véhicule de reconnaissance de la team (type reco) : la liste des règles de reco ne propose que ceux-là.
export async function ajouterVehiculeDeReco(equipe: Equipe, nomCourt: string): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO core_vehicle (id, team_id, type, nom_court, actif, updated_at)
     VALUES ($1, $2, 'reco'::core_vehicle_type, $3, true, now())`,
    [id, equipe.teamId, nomCourt],
  )
  return id
}

// Épreuve à venir (dates données, statut envisagé) : Saison la passe à « terminée » quand ses dates sont passées.
export async function ajouterEpreuveEnBase(equipe: Equipe, seasonId: string, nom: string, debut: string, fin: string): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO core_event (id, team_id, season_id, type, nom, date_debut, date_fin, updated_at)
     VALUES ($1, $2, $3, 'rallye'::core_event_type, $4, $5, $6, now())`,
    [id, equipe.teamId, seasonId, nom, debut, fin],
  )
  return id
}

// Statut d'une épreuve en base (envisagee, en_cours, terminee…).
export async function statutEpreuveEnBase(equipe: Equipe, eventId: string): Promise<string | null> {
  const { rows } = await bd().query(`SELECT statut FROM core_event WHERE team_id = $1 AND id = $2`, [equipe.teamId, eventId])
  return rows[0]?.statut ?? null
}

// Déplace une épreuve à des dates passées : Saison la passe à « terminée » au prochain chargement du QG.
export async function passerEpreuveDansLePasseEnBase(equipe: Equipe, eventId: string, debut: string, fin: string): Promise<void> {
  await bd().query(`UPDATE core_event SET date_debut = $3, date_fin = $4, updated_at = now() WHERE team_id = $1 AND id = $2`, [
    equipe.teamId,
    eventId,
    debut,
    fin,
  ])
}


// Livraisons du bus de la team, avec leur statut et le dernier message d'erreur (« aucun gestionnaire » compris).
export async function livraisonsEnBase(equipe: Equipe): Promise<string[]> {
  const { rows } = await bd().query(
    `SELECT e.nom, d.app_destinataire, d.statut, d.derniere_erreur FROM core_event_delivery d
     JOIN core_domain_event e ON e.id = d.domain_event_id
     WHERE d.team_id = $1 ORDER BY d.created_at`,
    [equipe.teamId],
  )
  return rows.map((r: { nom: string; app_destinataire: string; statut: string; derniere_erreur: string | null }) => `${r.nom} → ${r.app_destinataire} [${r.statut}] ${r.derniere_erreur ?? ""}`)
}

// --- Brief 3.9, §5 : données des vérifications du lot 3 (historique Voiture, papiers, résultat annulé) -----------

// Engagement d'un véhicule à une épreuve, inscrit. Renvoie l'identifiant de l'engagement.
// Statut « parti » : l'engagement a un dossier envoyé et payé, car Saison recalcule le statut à chaque chargement (sans
// inscription, il redevient « envisagé », et l'onglet Résultats reste vide). Un engagement parti apparaît dans l'onglet Résultats.
export async function engagerVehiculeEnBase(equipe: Equipe, eventId: string, vehicleId: string, statut: "inscrit" | "parti" = "inscrit"): Promise<string> {
  const id = newId()
  await bd().query(
    `INSERT INTO core_event_entry (id, team_id, event_id, vehicle_id, statut, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
    [id, equipe.teamId, eventId, vehicleId, statut],
  )
  if (statut === "parti") {
    await bd().query(
      `INSERT INTO saison_registration (id, team_id, entry_id, dossier_envoye_le, paye_le, updated_at) VALUES ($1, $2, $3, now(), current_date, now())`,
      [newId(), equipe.teamId, id],
    )
  }
  return id
}

// Résultat validé d'un engagement : une arrivée, classée au général.
export async function ajouterResultatValideEnBase(equipe: Equipe, entryId: string, classementGeneral: number): Promise<void> {
  await bd().query(
    `INSERT INTO saison_result (id, team_id, entry_id, statut_final, validation, classement_general, nb_classes, updated_at)
     VALUES ($1, $2, $3, 'arrivee', 'valide', $4, 40, now())`,
    [newId(), equipe.teamId, entryId, classementGeneral],
  )
}

// Spéciale d'une épreuve : longueur et nombre de passages (son km de spéciale est longueur × passages).
export async function ajouterSpecialeEnBase(equipe: Equipe, eventId: string, numero: number, nom: string, longueurKm: number, passages: number): Promise<void> {
  await bd().query(
    `INSERT INTO saison_stage (id, team_id, event_id, numero, nom, longueur_km, nb_passages, type, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'speciale', now())`,
    [newId(), equipe.teamId, eventId, numero, nom, longueurKm, passages],
  )
}

// Papier d'un véhicule (assurance, carte grise…) valable jusqu'à une date (AAAA-MM-JJ).
export async function ajouterPapierEnBase(equipe: Equipe, vehicleId: string, type: string, valableJusquAu: string): Promise<void> {
  await bd().query(
    `INSERT INTO voiture_paper (id, team_id, vehicle_id, type, valable_jusqu_au, updated_at) VALUES ($1, $2, $3, $4::voiture_paper_type, $5, now())`,
    [newId(), equipe.teamId, vehicleId, type, valableJusquAu],
  )
}

// Identifiant d'une épreuve de la team, par son nom (les noms des épreuves de test sont uniques).
export async function idEpreuveParNomEnBase(equipe: Equipe, nom: string): Promise<string | null> {
  const { rows } = await bd().query<{ id: string }>(`SELECT id FROM core_event WHERE team_id = $1 AND nom = $2 LIMIT 1`, [equipe.teamId, nom])
  return rows[0]?.id ?? null
}
