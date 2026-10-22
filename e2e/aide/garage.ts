// Atelier de test du Garage (tâche 4.2) : une voiture Saxo avec ses organes suivis, une pièce montée sur la plupart,
// à des états variés, écrits directement en base comme les autres aides. La team et la voiture viennent de session.ts ;
// supprimerEquipe efface toutes les lignes de la team, donc rien à nettoyer ici.

import "./env"

import { Pool } from "pg"

import { TYPES_DEFAUT } from "../../src/apps/garage/types-defaut"
import { newId } from "../../src/core/ids"

import type { Equipe } from "./session"

let pool: Pool | null = null

function bd(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
    if (!connectionString) throw new Error("DATABASE_URL_MIGRATION absente : les tests ne peuvent pas écrire l'atelier.")
    pool = new Pool({ connectionString, idleTimeoutMillis: 10_000, max: 2 })
  }
  return pool
}

// Organes de l'atelier de test, par clé de type. `ref` : durée de vie de référence de l'organe (km), `usure` : km de la
// pièce montée, `piece` : false pour un organe sans pièce. Les freins ont une pièce sans durée : « À renseigner ».
// Le mode « km » donne un état sans durée en épreuves ; le mode par défaut (« les deux ») attend les deux durées.
// La position est un emplacement de `emplacements.ts` (clé technique, comme le fait l'app à la préparation).
const ORGANES: Record<string, { position: string; mode?: "km"; ref: number | null; usure: number; piece: boolean; designation?: string; marque?: string; reference?: string }> = {
  moteur: { position: "unique", mode: "km", ref: 150000, usure: 30000, piece: true, designation: "Moteur reconditionné", marque: "Renault", reference: "K7M" },
  boite: { position: "unique", mode: "km", ref: 120000, usure: 96000, piece: true, designation: "Boîte 5 vitesses", marque: "Renault", reference: "JB1" },
  embrayage: { position: "unique", mode: "km", ref: 60000, usure: 59000, piece: true, designation: "Kit d'embrayage", marque: "Valeo", reference: "826578" },
  transmissions: { position: "gauche", ref: null, usure: 0, piece: false },
  freins: { position: "avant_droit", ref: null, usure: 0, piece: true, designation: "Disque et plaquettes", marque: "Brembo" },
  amortisseurs: { position: "avant_gauche", mode: "km", ref: 80000, usure: 8000, piece: true, designation: "Amortisseurs avant", marque: "Bilstein" },
  pneus: { position: "train", ref: null, usure: 0, piece: false },
}

// Prépare l'atelier de la voiture : gabarit Saxo, les types de la team, un organe par type, une pièce montée sur les
// organes qui en ont une. Renvoie l'identifiant de chaque organe, par clé de type.
export async function preparerAtelierSaxo(equipe: Equipe, vehicleId: string): Promise<Record<string, string>> {
  const client = await bd().connect()
  const organes: Record<string, string> = {}
  try {
    await client.query("BEGIN")
    await client.query(
      `UPDATE voiture_vehicle SET gabarit_cle = 'citadine_3p_saxo', updated_at = now() WHERE team_id = $1 AND vehicle_id = $2`,
      [equipe.teamId, vehicleId],
    )

    for (const type of TYPES_DEFAUT) {
      const typeId = newId()
      await client.query(
        `INSERT INTO garage_component_type (id, team_id, nom, cle, icone, critique, ordre, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [typeId, equipe.teamId, type.nom, type.cle, type.icone, type.critique, type.ordre],
      )

      const organe = ORGANES[type.cle]
      const organeId = newId()
      organes[type.cle] = organeId
      await client.query(
        `INSERT INTO garage_vehicle_component
           (id, team_id, vehicle_id, component_type_id, position, mode_usure, duree_vie_reference_km, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [organeId, equipe.teamId, vehicleId, typeId, organe.position ?? null, organe.mode ?? "les_deux", organe.ref],
      )

      if (!organe.piece) continue
      const pieceId = newId()
      await client.query(
        `INSERT INTO garage_part
           (id, team_id, vehicle_id, component_type_id, designation, marque, reference, statut, km_cumules, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'montee', $8, now())`,
        [pieceId, equipe.teamId, vehicleId, typeId, organe.designation, organe.marque ?? null, organe.reference ?? null, organe.usure],
      )
      await client.query(
        `INSERT INTO garage_part_mount (id, team_id, part_id, vehicle_component_id, posee_le, km_pose, updated_at)
         VALUES ($1, $2, $3, $4, now(), 0, now())`,
        [newId(), equipe.teamId, pieceId, organeId],
      )
    }

    await client.query("COMMIT")
    return organes
  } catch (erreur) {
    await client.query("ROLLBACK")
    throw erreur
  } finally {
    client.release()
  }
}

// Kilomètres cumulés de la pièce montée sur un organe, en base (pose en cours uniquement).
export async function kmPieceMonteeEnBase(organeId: string): Promise<number | null> {
  const { rows } = await bd().query<{ km_cumules: number | string }>(
    `SELECT p.km_cumules FROM garage_part_mount m
       JOIN garage_part p ON p.id = m.part_id
      WHERE m.vehicle_component_id = $1 AND m.deposee_le IS NULL AND m.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [organeId],
  )
  return rows[0] ? Number(rows[0].km_cumules) : null
}

// Un fournisseur de la team (core_contact), pour une commande de test. Renvoie son identifiant.
export async function fournisseurDeTest(equipe: Equipe, nom: string): Promise<string> {
  const id = newId()
  await bd().query(`INSERT INTO core_contact (id, team_id, nom, updated_at) VALUES ($1, $2, $3, now())`, [id, equipe.teamId, nom])
  return id
}

// Pièces créées par la réception d'une commande, par désignation : une ligne par unité, avec son prix et son fournisseur.
export async function piecesDeCommandeEnBase(
  equipe: Equipe,
  designation: string,
): Promise<Array<{ prix_cents: number | null; statut: string; fournisseur_contact_id: string | null; commande_ligne_id: string | null }>> {
  const { rows } = await bd().query(
    `SELECT prix_cents, statut, fournisseur_contact_id, commande_ligne_id FROM garage_part
      WHERE team_id = $1 AND designation = $2 AND deleted_at IS NULL ORDER BY created_at`,
    [equipe.teamId, designation],
  )
  return rows
}

// Ordres de travail de la team portant ce titre, pour vérifier une intervention écrite hors ligne après le retour du réseau.
export async function ordresEnBase(
  equipe: Equipe,
  titre: string,
): Promise<Array<{ statut: string; avancement_pct: number; origine: string; vehicle_component_id: string | null; vehicle_id: string }>> {
  const { rows } = await bd().query(
    `SELECT statut, avancement_pct, origine, vehicle_component_id, vehicle_id FROM garage_work_order
      WHERE team_id = $1 AND titre = $2 AND deleted_at IS NULL ORDER BY created_at`,
    [equipe.teamId, titre],
  )
  return rows
}

// Une pièce en stock (non montée) pour le type de l'organe donné : c'est ce que l'intervention propose en « Pièce utilisée ».
export async function pieceEnStockDeTest(equipe: Equipe, organeId: string, designation: string): Promise<void> {
  await bd().query(
    `INSERT INTO garage_part (id, team_id, vehicle_id, component_type_id, designation, statut, km_cumules, updated_at)
     SELECT $1, $2, vehicle_id, component_type_id, $3, 'en_stock', 0, now()
       FROM garage_vehicle_component WHERE id = $4 AND team_id = $2`,
    [newId(), equipe.teamId, designation, organeId],
  )
}

// Fiche personne du responsable, liée au compte comme la crée team:creer : core_person.user_id ET core_membership.person_id.
// Le Garage retrouve la personne du compte par user_id (sa synchro et ses services), donc rattacherPersonne ne suffit pas.
export async function personneResponsableDeTest(equipe: Equipe): Promise<string> {
  const personneId = newId()
  await bd().query(
    `INSERT INTO core_person (id, team_id, nom, prenom, user_id, updated_at) VALUES ($1, $2, 'E2E', 'Responsable', $3, now())`,
    [personneId, equipe.teamId, equipe.responsable.userId],
  )
  await bd().query(`UPDATE core_membership SET person_id = $1 WHERE id = $2`, [personneId, equipe.responsable.membershipId])
  return personneId
}
