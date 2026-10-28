// Aide des scénarios de Documents (tâche 5.3, brief §6) : une personne liée à un compte (la cible d'un partage et le
// propriétaire des documents d'un membre), et les lectures de l'état réel en base. Le rôle propriétaire lit tout.
import "./env"

import { Pool } from "pg"

import { newId } from "../../src/core/ids"

import type { Equipe, Membre } from "./session"

let pool: Pool | null = null

function bd(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
    if (!connectionString) throw new Error("DATABASE_URL_MIGRATION absente : les tests ne peuvent pas lire Documents.")
    pool = new Pool({ connectionString, idleTimeoutMillis: 10_000, max: 2 })
  }
  return pool
}

// Personne de la team liée au compte du membre : c'est elle qui apparaît dans la liste de partage et qui possède ses documents.
export async function rattacherPersonneAuCompte(equipe: Equipe, membre: Membre, prenom: string, nom: string): Promise<string> {
  const personneId = newId()
  await bd().query(
    "INSERT INTO core_person (id, team_id, nom, prenom, user_id, updated_at) VALUES ($1, $2, $3, $4, $5, now())",
    [personneId, equipe.teamId, nom, prenom, membre.userId],
  )
  await bd().query("UPDATE core_membership SET person_id = $1 WHERE id = $2", [personneId, membre.membershipId])
  return personneId
}

// Document de la team à ce titre, non supprimé : son statut, la version en cours et le nombre de versions.
export async function documentEnBase(equipe: Equipe, titre: string): Promise<{ id: string; statut: string; versionCourante: number | null; versions: number } | null> {
  const { rows } = await bd().query<{ id: string; statut: string; version_courante: number | null; versions: number }>(
    `SELECT d.id, d.status::text AS statut, v.version_no AS version_courante,
            (SELECT count(*)::int FROM documents_version x WHERE x.doc_id = d.id AND x.deleted_at IS NULL) AS versions
     FROM documents_doc d LEFT JOIN documents_version v ON v.id = d.current_version_id
     WHERE d.team_id = $1 AND d.title = $2 AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC LIMIT 1`,
    [equipe.teamId, titre],
  )
  const ligne = rows[0]
  if (!ligne) return null
  return { id: ligne.id, statut: ligne.statut, versionCourante: ligne.version_courante, versions: ligne.versions }
}

// Dossiers types de la team portant ce nom (une seule ligne attendue), non supprimés.
export async function dossiersTypesEnBase(equipe: Equipe, nom: string): Promise<number> {
  const { rows } = await bd().query<{ n: number }>(
    "SELECT count(*)::int AS n FROM documents_folder WHERE team_id = $1 AND kind = 'systeme' AND name = $2 AND deleted_at IS NULL",
    [equipe.teamId, nom],
  )
  return rows[0].n
}

// Date de validité d'un document (AAAA-MM-JJ), ou null.
export async function echeanceEnBase(equipe: Equipe, docId: string): Promise<string | null> {
  const { rows } = await bd().query<{ jour: string | null }>(
    "SELECT to_char(valid_until, 'YYYY-MM-DD') AS jour FROM documents_doc WHERE team_id = $1 AND id = $2",
    [equipe.teamId, docId],
  )
  return rows[0]?.jour ?? null
}

// Accès interne accordé à une personne sur un document : son niveau, ou null.
export async function accesDocumentEnBase(equipe: Equipe, docId: string, personneId: string): Promise<string | null> {
  const { rows } = await bd().query<{ niveau: string }>(
    "SELECT level::text AS niveau FROM documents_access WHERE team_id = $1 AND doc_id = $2 AND person_id = $3 AND deleted_at IS NULL",
    [equipe.teamId, docId, personneId],
  )
  return rows[0]?.niveau ?? null
}
