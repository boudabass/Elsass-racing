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

export async function statutAction(equipe: Equipe, cleUnicite: string): Promise<string | null> {
  const { rows } = await bd().query<{ statut: string }>(
    "SELECT statut::text AS statut FROM core_action WHERE team_id = $1 AND cle_unicite = $2",
    [equipe.teamId, cleUnicite],
  )
  return rows[0]?.statut ?? null
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

// Saison (2.3) : donne à un membre un niveau explicite sur Saison, pour que le scénario ne dépende
// pas des valeurs par défaut des rôles.
export async function donnerAccesSaison(equipe: Equipe, membre: Membre, niveau: "lecture" | "contribution" | "ecriture" | "gestion"): Promise<void> {
  await bd().query(
    `INSERT INTO core_app_access (id, team_id, membership_id, app_cle, niveau, updated_at)
     VALUES ($1, $2, $3, 'saison', $4::core_access_level, now())`,
    [newId(), equipe.teamId, membre.membershipId, niveau],
  )
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
